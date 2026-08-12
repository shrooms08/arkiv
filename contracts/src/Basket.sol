// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";

import {IArkiv} from "./interfaces/IArkiv.sol";
import {IDexAdapter} from "./interfaces/IDexAdapter.sol";

/// @title Basket
/// @notice One thesis. An ERC-20 share token over a fixed set of xStocks
/// wrappers, minted with USDG and redeemed in-kind.
///
/// ## Share accounting
///
/// `shares = S * min_i(d_i / B_i)` — the price-free multi-asset mint. `d_i` is
/// the amount of leg `i` actually received (measured, not quoted), `B_i` is the
/// accounted reserve, `S` the current supply. The worst leg sets the share
/// count, so no minter can be credited for value the basket did not receive.
///
/// Because the worst leg binds, the other legs deliver more than the share count
/// paid for. That excess is REFUNDED IN KIND rather than donated to existing
/// holders: `used_i = ceil(B_i * shares / S)` and `d_i - used_i` goes back to the
/// minter. On a 50 bp spread across legs that is roughly $25 on a $5,000 mint.
/// It leaves dust in the minter's wallet, which is honest.
///
/// ## The mint fee sits outside the share maths
///
/// The fee is taken off the incoming USDG BEFORE anything is swapped, and only
/// the net reaches the legs. Nothing downstream knows a fee happened: `d_i` is
/// still a measured balance delta, `shares` is still `S * min_i(d_i / B_i)`, and
/// the first mint still fixes its basis on the USDG that actually bought assets.
/// Fewer dollars in means fewer units received and proportionally fewer shares —
/// which is the whole of the fee's effect on a depositor.
///
/// There is no redemption fee, at any setting. R10 keeps the exit unconditional.
///
/// ## Buy and hold
///
/// Thesis weights are declared once, at creation, and never change. The basket
/// does not rebalance. What one share is backed by, in UNITS, is invariant — it
/// does not move when other people mint. So any change in the value split
/// between legs is the legs' prices moving, which is the performance of the
/// thesis, and never an artefact of someone else's execution.
///
/// ## Donations are inert
///
/// Accounting runs on `reserves`, credited only from measured deltas of the
/// basket's own legs during a mint. Anything else sent here — a rebasing base
/// token, a decoy "xStocks" ERC-20, or even more of a real leg — is never
/// counted and never redeemable. It sits there.
///
/// This is also why the classic first-depositor inflation attack does not apply:
/// donating tokens to the vault cannot move `B_i`, because `B_i` is not a
/// balance. See `DEAD_SHARES` for the second, independent guard.
contract Basket is ERC20, ReentrancyGuardTransient {
    using SafeERC20 for IERC20;

    uint256 public constant BPS = 10_000;

    /// @notice USDG is 6 decimals; shares are 18. The first mint fixes the basis
    /// at 1 share ≈ $1, so a $5,000 opening mint issues 5,000e18 shares.
    uint256 public constant FIRST_MINT_SCALE = 1e12;

    /// @notice Shares minted to an unspendable address on the first mint, paid
    /// for by the first minter.
    ///
    /// @dev Two jobs, both structural rather than cosmetic:
    ///
    ///  1. `S` can never return to a value small enough for `S * d_i / B_i` to
    ///     round to zero, so no opening position can leave the basket in a state
    ///     where later mints are priced out.
    ///  2. More importantly, they make `B_i > 0` an invariant for the life of the
    ///     basket. A redeemer takes `floor(B_i * shares / S)`, so the residue
    ///     left behind is `ceil(B_i * DEAD_SHARES / S)`, which is at least 1 wei
    ///     whenever `B_i >= 1`. Without them, redeeming the entire supply could
    ///     zero a leg and permanently brick `mint` on `EmptyLeg`.
    uint256 public constant DEAD_SHARES = 1000;

    /// @notice Where the dead shares go.
    /// @dev Uniswap V2 burns its MINIMUM_LIQUIDITY to `address(0)`. That is not
    /// available here: OpenZeppelin's `ERC20._mint` reverts with
    /// `ERC20InvalidReceiver` on the zero address. `0x…dEaD` is the equivalent
    /// unspendable sink — no key exists for it — not an arbitrary choice.
    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    IArkiv public immutable arkiv;
    address public immutable usdg;
    uint64 public immutable createdAt;

    address[] internal _tokens;
    uint16[] internal _thesisWeightsBps;

    /// @notice Off-chain pointer to the thesis text and its falsifier.
    string public thesisURI;

    /// @notice Accounted units per leg. NOT `balanceOf` — see "Donations are inert".
    mapping(address token => uint256) public reserves;

    error OnlyArkiv();
    error ArrayLengthMismatch();
    error SplitMismatch(uint256 sum, uint256 netUsdgIn);
    error ZeroSplit(uint256 index);
    error LegSlippage(uint256 index, address token, uint256 received, uint256 minAmountOut);
    error InsufficientShares(uint256 shares, uint256 minSharesOut);
    error EmptyLeg(address token);
    error ZeroShares();
    error BelowMinimumFirstMint(uint256 usdgIn, uint256 required);
    error RedeemSlippage(uint256 index, address token, uint256 amount, uint256 minAmountOut);

    /// @param usdgIn Gross USDG the minter paid.
    /// @param fee Taken off `usdgIn` before the split; `usdgIn - fee` bought legs.
    /// @param bindingToken The leg that set the share count — the worst leg.
    /// Zero on the first mint, which takes a fixed basis and has no ratio.
    event Minted(
        address indexed minter,
        address indexed receiver,
        uint256 usdgIn,
        uint256 fee,
        uint256 shares,
        address bindingToken,
        uint256[] received,
        uint256[] used
    );

    event Redeemed(address indexed redeemer, address indexed receiver, uint256 shares, uint256[] amounts);

    constructor(
        address _arkiv,
        address _usdg,
        string memory _name,
        string memory _symbol,
        address[] memory tokens_,
        uint16[] memory weights_,
        string memory _thesisURI
    ) ERC20(_name, _symbol) {
        // Baskets are only ever deployed by Arkiv.createBasket, which is where
        // the leg count, weights, allowlist and core-floor rules are enforced.
        if (msg.sender != _arkiv) revert OnlyArkiv();
        if (tokens_.length != weights_.length) revert ArrayLengthMismatch();

        arkiv = IArkiv(_arkiv);
        usdg = _usdg;
        _tokens = tokens_;
        _thesisWeightsBps = weights_;
        thesisURI = _thesisURI;
        createdAt = uint64(block.timestamp);
    }

    // ---------------------------------------------------------------------
    // Mint
    // ---------------------------------------------------------------------

    /// @notice Deposit USDG, swap it into the legs, receive shares.
    /// @param usdgIn Total USDG to spend, in base units (6 decimals). The mint
    /// fee is taken from this, and `usdgIn - fee` is what the split must cover.
    /// Call `Arkiv.quoteMintFee` to size the split.
    /// @param usdgSplit How much USDG to send to each leg. Chosen off-chain from
    /// a quote sized to current composition. A quote used to *route* is not an
    /// oracle in the settlement path: it decides how much to spend where, and
    /// nothing about it enters the share calculation.
    /// @param minAmountsOut Per-leg floor, checked against the MEASURED balance
    /// delta rather than the adapter's return value.
    /// @param minSharesOut Floor on the share count. Per-leg floors alone are not
    /// enough: shares are bounded by the WORST leg across all legs, so a minter
    /// can clear every leg's slippage check and still be badly under-shared. This
    /// is the only parameter that protects the thing the minter actually buys.
    function mint(
        uint256 usdgIn,
        uint256[] calldata usdgSplit,
        uint256[] calldata minAmountsOut,
        uint256 minSharesOut,
        address receiver
    ) external nonReentrant returns (uint256 shares) {
        uint256 n = _tokens.length;
        if (usdgSplit.length != n || minAmountsOut.length != n) revert ArrayLengthMismatch();

        // Pause, cap and sanctions, before any funds move. The cap is on the
        // gross amount — it is what the depositor parts with.
        arkiv.checkMint(msg.sender, receiver, usdgIn);

        // Fee first, so everything after this line is about the money that
        // actually buys assets.
        uint256 fee = (usdgIn * arkiv.feeBps()) / BPS;
        uint256 netUsdgIn = usdgIn - fee;

        uint256 splitSum;
        for (uint256 i; i < n; ++i) {
            if (usdgSplit[i] == 0) revert ZeroSplit(i);
            splitSum += usdgSplit[i];
        }
        if (splitSum != netUsdgIn) revert SplitMismatch(splitSum, netUsdgIn);

        bool firstMint = totalSupply() == 0;
        if (firstMint) {
            uint256 required = arkiv.minFirstMint();
            if (usdgIn < required) revert BelowMinimumFirstMint(usdgIn, required);
        }

        IERC20(usdg).safeTransferFrom(msg.sender, address(this), usdgIn);

        // Hand the fee to the registry and let it book the split. Doing this
        // before the swaps keeps the basket's USDG balance equal to what it is
        // about to spend, so a partial failure cannot leave fee money stranded
        // here looking like reserve.
        if (fee != 0) {
            IERC20(usdg).safeTransfer(address(arkiv), fee);
            arkiv.recordFee(fee);
        }

        uint256[] memory received = _swapLegs(netUsdgIn, usdgSplit, minAmountsOut, n);

        uint256[] memory used = new uint256[](n);
        address bindingToken;
        uint256 supply = totalSupply();

        if (firstMint) {
            // First mint sets the basis. No ratio to take a minimum of, and
            // nothing to refund: everything received becomes reserve.
            for (uint256 i; i < n; ++i) {
                if (received[i] == 0) revert EmptyLeg(_tokens[i]);
                used[i] = received[i];
            }

            // Basis on the NET, not the gross. One share must be backed by one
            // dollar that actually reached the legs; issuing against the fee too
            // would open every basket slightly above its own backing.
            uint256 gross = netUsdgIn * FIRST_MINT_SCALE;
            // Cannot underflow given a sane minFirstMint, but a bad admin value
            // should surface as this error rather than as a panic.
            if (gross <= DEAD_SHARES) revert BelowMinimumFirstMint(usdgIn, arkiv.minFirstMint());
            shares = gross - DEAD_SHARES;
        } else {
            shares = type(uint256).max;
            uint256 bindingIndex;

            for (uint256 i; i < n; ++i) {
                uint256 reserve = reserves[_tokens[i]];
                if (reserve == 0) revert EmptyLeg(_tokens[i]);

                uint256 candidate = (supply * received[i]) / reserve;
                if (candidate < shares) {
                    shares = candidate;
                    bindingIndex = i;
                }
            }
            bindingToken = _tokens[bindingIndex];

            // Round the amount consumed UP, so rounding favours the basket and
            // never the minter. used_i <= d_i holds because shares was floored.
            for (uint256 i; i < n; ++i) {
                used[i] = _mulDivUp(reserves[_tokens[i]], shares, supply);
            }
        }

        if (shares == 0) revert ZeroShares();
        if (shares < minSharesOut) revert InsufficientShares(shares, minSharesOut);

        for (uint256 i; i < n; ++i) {
            reserves[_tokens[i]] += used[i];
        }

        if (firstMint) _mint(DEAD_ADDRESS, DEAD_SHARES);
        _mint(receiver, shares);

        // State is fully settled before any token leaves. Refunds go to the
        // payer, not the share receiver.
        for (uint256 i; i < n; ++i) {
            uint256 refund = received[i] - used[i];
            if (refund != 0) IERC20(_tokens[i]).safeTransfer(msg.sender, refund);
        }

        emit Minted(msg.sender, receiver, usdgIn, fee, shares, bindingToken, received, used);
    }

    /// @dev Split out to keep `mint` under the stack limit.
    /// @param netUsdgIn Post-fee USDG. The approval is sized to exactly this, so
    /// the adapter can never reach the fee even for the length of one call.
    function _swapLegs(uint256 netUsdgIn, uint256[] calldata usdgSplit, uint256[] calldata minAmountsOut, uint256 n)
        internal
        returns (uint256[] memory received)
    {
        IDexAdapter adapter = arkiv.dexAdapter();
        IERC20(usdg).forceApprove(address(adapter), netUsdgIn);

        received = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            address token = _tokens[i];
            uint256 balanceBefore = IERC20(token).balanceOf(address(this));

            adapter.swapExactInput(usdg, token, usdgSplit[i], minAmountsOut[i], address(this));

            // Measured delta. The adapter's return value is never used: a lying
            // pool or adapter cannot inflate shares, it can only give a bad
            // price, which this check and minSharesOut reject.
            uint256 delta = IERC20(token).balanceOf(address(this)) - balanceBefore;
            if (delta < minAmountsOut[i]) revert LegSlippage(i, token, delta, minAmountsOut[i]);

            received[i] = delta;
        }

        // Leave no standing allowance.
        IERC20(usdg).forceApprove(address(adapter), 0);
    }

    // ---------------------------------------------------------------------
    // Redeem
    // ---------------------------------------------------------------------

    /// @notice Burn shares, receive a pro-rata slice of every leg in kind.
    /// @dev Deliberately NOT pausable and NOT sanctions-gated. Redemption touches
    /// no pool, so it is not exposed to liquidity at all, and a redeemer chooses
    /// their own exit. Gating the exit would let an admin key or a third-party
    /// list trap user funds in the vault; screening belongs on the way in.
    ///
    /// It also charges NO FEE, reads no fee parameter, and never calls the
    /// registry. Nothing the owner or the attestor can set reaches this
    /// function — a breached basket redeems exactly like an unbreached one,
    /// because breach is a verdict on a claim and not a claim on anyone's money.
    function redeem(uint256 shares, address receiver, uint256[] calldata minAmountsOut)
        external
        nonReentrant
        returns (uint256[] memory amounts)
    {
        uint256 n = _tokens.length;
        if (minAmountsOut.length != n) revert ArrayLengthMismatch();
        if (shares == 0) revert ZeroShares();

        uint256 supply = totalSupply();
        amounts = new uint256[](n);

        // Burn first: the supply used for the pro-rata maths is the pre-burn one,
        // and the caller's balance check happens here.
        _burn(msg.sender, shares);

        for (uint256 i; i < n; ++i) {
            address token = _tokens[i];
            uint256 amount = (reserves[token] * shares) / supply;
            if (amount < minAmountsOut[i]) revert RedeemSlippage(i, token, amount, minAmountsOut[i]);

            reserves[token] -= amount;
            amounts[i] = amount;
        }

        for (uint256 i; i < n; ++i) {
            if (amounts[i] != 0) IERC20(_tokens[i]).safeTransfer(receiver, amounts[i]);
        }

        emit Redeemed(msg.sender, receiver, shares, amounts);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @notice The two numbers the UI shows side by side.
    /// @return tokens_ The legs.
    /// @return thesisWeights What was declared at creation. Immutable.
    /// @return reserves_ Accounted units held now. Convert to display weights
    /// off-chain — this contract has no oracle and takes no view on what a leg
    /// is worth.
    /// @return supply Share supply, for units-per-share.
    function composition()
        external
        view
        returns (address[] memory tokens_, uint16[] memory thesisWeights, uint256[] memory reserves_, uint256 supply)
    {
        uint256 n = _tokens.length;
        tokens_ = _tokens;
        thesisWeights = _thesisWeightsBps;
        reserves_ = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            reserves_[i] = reserves[_tokens[i]];
        }
        supply = totalSupply();
    }

    /// @notice What one whole share (1e18) is currently backed by, per leg.
    function unitsPerShare() external view returns (address[] memory tokens_, uint256[] memory units) {
        uint256 n = _tokens.length;
        tokens_ = _tokens;
        units = new uint256[](n);

        uint256 supply = totalSupply();
        if (supply == 0) return (tokens_, units);

        for (uint256 i; i < n; ++i) {
            units[i] = (reserves[_tokens[i]] * 1e18) / supply;
        }
    }

    /// @notice What a redemption of `shares` would pay out right now.
    function previewRedeem(uint256 shares) external view returns (uint256[] memory amounts) {
        uint256 n = _tokens.length;
        amounts = new uint256[](n);

        uint256 supply = totalSupply();
        if (supply == 0) return amounts;

        for (uint256 i; i < n; ++i) {
            amounts[i] = (reserves[_tokens[i]] * shares) / supply;
        }
    }

    function tokens() external view returns (address[] memory) {
        return _tokens;
    }

    function thesisWeightsBps() external view returns (uint16[] memory) {
        return _thesisWeightsBps;
    }

    function legCount() external view returns (uint256) {
        return _tokens.length;
    }

    /// @notice Tokens sitting here that no share can claim — donations, dust,
    /// anything sent in by mistake. Surfaced so it is visible rather than
    /// mysterious. There is no sweep: nothing here can be moved by anyone.
    function unaccounted(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this)) - reserves[token];
    }

    function _mulDivUp(uint256 a, uint256 b, uint256 denominator) internal pure returns (uint256) {
        return a == 0 ? 0 : ((a * b) + denominator - 1) / denominator;
    }
}
