// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IArkiv} from "./interfaces/IArkiv.sol";
import {IDexAdapter} from "./interfaces/IDexAdapter.sol";
import {ISanctionsList} from "./interfaces/ISanctionsList.sol";
import {Basket} from "./Basket.sol";

/// @title Arkiv
/// @notice Registry and factory. Holds the asset allowlist, the mint cap, the
/// DEX adapter and the pause switch; deploys baskets and enforces the
/// composition rules at creation time. Also the fee ledger: mint fees are booked
/// here and split between the basket's curator and the protocol.
///
/// Basket creation is permissionless. Every constraint that matters is checked
/// on-chain here, so there is nothing an untrusted creator can smuggle past —
/// and the archive is more honest if it records what people actually believed
/// rather than what an operator approved.
///
/// ## The economics, and why they need a falsifier
///
/// A mint charges `feeBps` on the USDG coming in. `curatorBps` of that accrues
/// to the basket's creator; the rest to the protocol. **Curator accrual stops
/// permanently once the basket's falsifier is attested breached** — from that
/// point the whole fee goes to the protocol.
///
/// That last rule is the product. Every creator programme in DeFi pays on
/// volume, so the incentive is to publish loudly. This pays on being right,
/// which is only expressible because a basket carries a falsifiable claim
/// recorded at creation. A thesis that turned out wrong stops earning.
contract Arkiv is IArkiv, Ownable2Step {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------------
    // Composition rules
    // ---------------------------------------------------------------------

    uint256 public constant BPS = 10_000;

    /// @notice Legs per basket, not allowlist size, is the cost driver: L1 data
    /// fee scales with calldata and each leg is another swap.
    uint256 public constant MAX_LEGS = 8;
    uint256 public constant MIN_LEGS = 2;

    /// @notice Below this a leg costs more in gas and slippage than it
    /// contributes in expression.
    uint256 public constant MIN_LEG_BPS = 500;

    /// @notice Index assets keep the mint in the deeper pools. GLDx counts as
    /// core: measured depth ($279,749 USDG, 22 bp at $5k) is the best of any
    /// asset in the universe, and gold as a liquid anchor is what makes macro
    /// theses expressible.
    /// @dev A floor, and deliberately no ceiling. This rule is about LIQUIDITY:
    /// it keeps the mint in deep pools so slippage stays inside budget. A basket
    /// that is 100% index is less risky, not more, so the vault has no business
    /// rejecting it. Whether a basket actually expresses a view is a product
    /// concern, enforced where the underwriter's output is validated.
    uint256 public constant MIN_CORE_BPS = 5000;

    // ---------------------------------------------------------------------
    // Fee rules
    // ---------------------------------------------------------------------

    /// @notice Hard ceiling on the mint fee, enforced in `setFeeBps`.
    ///
    /// @dev A constant, not an owner-settable bound, so the fee cannot be raised
    /// arbitrarily by the key that collects it. 100 bps is the whole promise: a
    /// depositor can read this number once and know the worst case for every
    /// future mint without trusting anyone. There is no corresponding redemption
    /// fee at any value — see `Basket.redeem` and R10.
    uint256 public constant MAX_FEE_BPS = 100;

    /// @notice Mint fee in basis points on the USDG coming in. Default 30.
    uint256 public feeBps = 30;

    /// @notice Curator's share of the mint fee, in basis points. Default 5000,
    /// meaning half. Applies only while the basket is unbreached.
    uint256 public curatorBps = 5000;

    // ---------------------------------------------------------------------
    // State
    // ---------------------------------------------------------------------

    /// @notice Global Dollar. 6 decimals, not 18.
    address public immutable usdg;

    /// @notice Backed's deny-list. Read directly; the wrappers do not expose one.
    ISanctionsList public immutable sanctions;

    struct AssetInfo {
        bool allowed;
        bool isCore;
    }

    mapping(address wrapper => AssetInfo) public assetInfo;

    IDexAdapter public dexAdapter;

    /// @notice Maximum USDG per mint, in base units. Launch value 5_000_000_000
    /// (= $5,000 at 6 decimals). A depth-linked limit, not an arbitrary throttle.
    uint256 public mintCap;

    /// @notice Floor on the USDG of a basket's FIRST mint. A basket opened at a
    /// dust basis would have coarse rounding for everyone after, and would
    /// pollute the archive with baskets nobody meant. Launch value 10_000_000
    /// (= $10 at 6 decimals).
    uint256 public minFirstMint;

    /// @notice Blocks minting. Never blocks redemption.
    bool public paused;

    /// @notice The only address that may attest a breach.
    ///
    /// @dev A single address today, which is a real trust assumption and is
    /// documented as one in RISKS.md R13. It can end a curator's income stream
    /// but it cannot touch principal: breach affects fee routing only, and
    /// redemption never consults it.
    address public attestor;

    address[] public baskets;
    mapping(address => bool) public isBasket;

    /// @notice Who wrote the thesis. Recorded at creation and never changes.
    /// @dev The `BasketCreated` event alone was not enough: fee routing needs
    /// this at mint time, and an event is not readable from a contract.
    mapping(address basket => address) public creatorOf;

    /// @notice Baskets a curator has authored, in creation order.
    mapping(address curator => address[]) internal _authoredBy;

    /// @notice Whether a basket's falsifier has been attested breached.
    mapping(address basket => bool) public breached;

    /// @notice When it was attested. Zero while unbreached.
    mapping(address basket => uint64) public breachedAt;

    /// @notice How many of a curator's baskets have been breached.
    mapping(address curator => uint256) public breachedCountOf;

    /// @notice Claimable USDG accrued to a curator from unbreached baskets.
    mapping(address curator => uint256) public curatorEarnings;

    /// @notice Claimable USDG accrued to the protocol.
    uint256 public protocolEarnings;

    error NotAllowed(address token);
    error RebasingToken(address token);
    error BadLegCount(uint256 legs);
    error LegBelowMinimum(address token, uint256 bps);
    error WeightsMustSumToBps(uint256 sum);
    error TokensNotAscending(address previous, address next);
    error CoreBelowMinimum(uint256 coreBps);
    error ArrayLengthMismatch();
    error ZeroAddress();
    error Paused();
    error ZeroAmount();
    error AboveMintCap(uint256 usdgIn, uint256 cap);
    error Sanctioned(address account);
    error FeeAboveCap(uint256 requested, uint256 cap);
    error CuratorShareAboveBps(uint256 requested);
    error NotABasket(address caller);
    error OnlyAttestor(address caller);
    error AlreadyBreached(address basket);
    error NothingToClaim();
    error UnknownBasket(uint256 basketId);

    event AssetSet(address indexed wrapper, bool allowed, bool isCore);
    event DexAdapterSet(address indexed previous, address indexed next);
    event MintCapSet(uint256 previous, uint256 next);
    event MinFirstMintSet(uint256 previous, uint256 next);
    event PausedSet(bool paused);
    event FeeBpsSet(uint256 previous, uint256 next);
    event CuratorBpsSet(uint256 previous, uint256 next);
    event AttestorSet(address indexed previous, address indexed next);
    event BasketCreated(
        address indexed basket,
        address indexed creator,
        string name,
        string symbol,
        address[] tokens,
        uint16[] thesisWeightsBps,
        string thesisURI
    );

    /// @param curatorAmount Zero once the basket is breached.
    event FeeRecorded(
        address indexed basket, address indexed curator, uint256 amount, uint256 curatorAmount, bool basketBreached
    );
    event CuratorFeesClaimed(address indexed curator, address indexed receiver, uint256 amount);
    event ProtocolFeesClaimed(address indexed receiver, uint256 amount);

    /// @param evidenceHash Commitment to the off-chain record naming the
    /// observable that was breached and the source it was read from. Keyed the
    /// same way as the underwriting record, so the two can be joined.
    event BreachAttested(
        address indexed basket, uint256 indexed basketId, bytes32 evidenceHash, uint64 attestedAt, address attestor
    );

    constructor(
        address _usdg,
        address _sanctions,
        address _dexAdapter,
        uint256 _mintCap,
        uint256 _minFirstMint,
        address initialOwner
    ) Ownable(initialOwner) {
        if (_usdg == address(0) || _sanctions == address(0) || _dexAdapter == address(0)) {
            revert ZeroAddress();
        }
        usdg = _usdg;
        sanctions = ISanctionsList(_sanctions);
        dexAdapter = IDexAdapter(_dexAdapter);
        mintCap = _mintCap;
        minFirstMint = _minFirstMint;

        // The owner attests until a dedicated key or committee is set. Stated
        // rather than silently left at address(0), which would make breach
        // unreachable and quietly turn the product into a volume programme.
        attestor = initialOwner;

        emit DexAdapterSet(address(0), _dexAdapter);
        emit MintCapSet(0, _mintCap);
        emit MinFirstMintSet(0, _minFirstMint);
        emit AttestorSet(address(0), initialOwner);
        emit FeeBpsSet(0, feeBps);
        emit CuratorBpsSet(0, curatorBps);
    }

    // ---------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------

    /// @notice Add or remove an asset from the allowlist.
    /// @dev Rejects rebasing tokens by probing `multiplier()`. Every xStocks
    /// *base* token answers that call; every *wrapper* reverts on it (verified
    /// across 20 probes). So this is not a hand-maintained deny-list of base
    /// addresses that someone must remember to update — it is a property test
    /// the token either passes or fails, and it makes the R6 invariant
    /// "no rebasing token ever enters the vault" self-enforcing against operator
    /// error as well as against new assets nobody has classified yet.
    function setAssetAllowed(address wrapper, bool allowed, bool isCore) external onlyOwner {
        if (wrapper == address(0)) revert ZeroAddress();
        if (allowed && _isRebasing(wrapper)) revert RebasingToken(wrapper);
        assetInfo[wrapper] = AssetInfo({allowed: allowed, isCore: isCore});
        emit AssetSet(wrapper, allowed, isCore);
    }

    /// @notice Replace the DEX adapter.
    /// @dev The sharp admin function. A malicious adapter could misroute the
    /// funds of a *new* mint. It cannot touch existing holdings: redemption is
    /// in-kind and pays from each basket's own accounted reserves without
    /// consulting the adapter at all. See docs/RISKS.md R8.
    function setDexAdapter(address next) external onlyOwner {
        if (next == address(0)) revert ZeroAddress();
        emit DexAdapterSet(address(dexAdapter), next);
        dexAdapter = IDexAdapter(next);
    }

    function setMintCap(uint256 next) external onlyOwner {
        emit MintCapSet(mintCap, next);
        mintCap = next;
    }

    function setMinFirstMint(uint256 next) external onlyOwner {
        emit MinFirstMintSet(minFirstMint, next);
        minFirstMint = next;
    }

    function setPaused(bool next) external onlyOwner {
        paused = next;
        emit PausedSet(next);
    }

    /// @notice Set the mint fee. Reverts above `MAX_FEE_BPS`.
    /// @dev Zero is allowed and is a valid configuration, not a disabled state.
    function setFeeBps(uint256 next) external onlyOwner {
        if (next > MAX_FEE_BPS) revert FeeAboveCap(next, MAX_FEE_BPS);
        emit FeeBpsSet(feeBps, next);
        feeBps = next;
    }

    /// @notice Set the curator's share of the mint fee.
    /// @dev Bounded by BPS only. Unlike the fee itself this cannot extract from
    /// users — it moves value between the curator and the protocol, both of whom
    /// are downstream of a fee the depositor has already agreed to.
    function setCuratorBps(uint256 next) external onlyOwner {
        if (next > BPS) revert CuratorShareAboveBps(next);
        emit CuratorBpsSet(curatorBps, next);
        curatorBps = next;
    }

    function setAttestor(address next) external onlyOwner {
        if (next == address(0)) revert ZeroAddress();
        emit AttestorSet(attestor, next);
        attestor = next;
    }

    // ---------------------------------------------------------------------
    // Basket creation
    // ---------------------------------------------------------------------

    /// @param tokens Wrapper addresses, strictly ascending. Ascending order is
    /// how duplicates are rejected: it costs one comparison per leg instead of a
    /// nested loop, and it gives every basket a canonical leg ordering.
    function createBasket(
        string calldata name,
        string calldata symbol,
        address[] calldata tokens,
        uint16[] calldata thesisWeightsBps,
        string calldata thesisURI
    ) external returns (address basket) {
        uint256 n = tokens.length;
        if (n != thesisWeightsBps.length) revert ArrayLengthMismatch();
        if (n < MIN_LEGS || n > MAX_LEGS) revert BadLegCount(n);

        uint256 sum;
        uint256 coreBps;
        address previous;

        for (uint256 i; i < n; ++i) {
            address token = tokens[i];
            if (token <= previous) revert TokensNotAscending(previous, token);
            previous = token;

            AssetInfo memory info = assetInfo[token];
            if (!info.allowed) revert NotAllowed(token);

            uint256 bps = thesisWeightsBps[i];
            if (bps < MIN_LEG_BPS) revert LegBelowMinimum(token, bps);

            sum += bps;
            if (info.isCore) coreBps += bps;
        }

        if (sum != BPS) revert WeightsMustSumToBps(sum);
        if (coreBps < MIN_CORE_BPS) revert CoreBelowMinimum(coreBps);

        basket = address(new Basket(address(this), usdg, name, symbol, tokens, thesisWeightsBps, thesisURI));

        baskets.push(basket);
        isBasket[basket] = true;
        creatorOf[basket] = msg.sender;
        _authoredBy[msg.sender].push(basket);

        emit BasketCreated(basket, msg.sender, name, symbol, tokens, thesisWeightsBps, thesisURI);
    }

    // ---------------------------------------------------------------------
    // Fees
    // ---------------------------------------------------------------------

    /// @inheritdoc IArkiv
    ///
    /// @dev The basket transfers the USDG here and then calls this to book it.
    /// Only a basket this registry deployed may call, so the amount is asserted
    /// by code this contract itself created rather than by an arbitrary caller.
    ///
    /// Accrual, not transfer: paying two recipients on every mint would put two
    /// ERC-20 transfers in the hot path and make mint gas depend on who the
    /// curator is. Claiming is the curator's problem, once, at a time of their
    /// choosing.
    function recordFee(uint256 amount) external {
        if (!isBasket[msg.sender]) revert NotABasket(msg.sender);
        if (amount == 0) return;

        address curator = creatorOf[msg.sender];
        bool isBreached = breached[msg.sender];

        // The whole mechanism, in one line: a breached thesis earns its author
        // nothing from this point on, and the fee routes entirely to the
        // protocol. Already-accrued balances are untouched — the stream stops,
        // it is not clawed back.
        uint256 curatorAmount = isBreached ? 0 : (amount * curatorBps) / BPS;

        if (curatorAmount != 0) curatorEarnings[curator] += curatorAmount;
        protocolEarnings += amount - curatorAmount;

        emit FeeRecorded(msg.sender, curator, amount, curatorAmount, isBreached);
    }

    /// @notice Pull everything accrued to the caller as a curator.
    function claimCuratorFees() external returns (uint256 amount) {
        amount = curatorEarnings[msg.sender];
        if (amount == 0) revert NothingToClaim();

        // Zero before transferring. USDG is a plain ERC-20 with no callback, but
        // the ordering costs nothing and does not depend on that staying true.
        curatorEarnings[msg.sender] = 0;
        IERC20(usdg).safeTransfer(msg.sender, amount);

        emit CuratorFeesClaimed(msg.sender, msg.sender, amount);
    }

    function claimProtocolFees(address to) external onlyOwner returns (uint256 amount) {
        if (to == address(0)) revert ZeroAddress();
        amount = protocolEarnings;
        if (amount == 0) revert NothingToClaim();

        protocolEarnings = 0;
        IERC20(usdg).safeTransfer(to, amount);

        emit ProtocolFeesClaimed(to, amount);
    }

    // ---------------------------------------------------------------------
    // Breach attestation
    // ---------------------------------------------------------------------

    /// @notice Record that a basket's falsifier has been breached.
    ///
    /// @param basketId Index into the archive — the same number the UI shows as
    /// the basket's serial, minus one.
    /// @param evidenceHash Commitment to the off-chain record naming the
    /// observable and the source. Stored in the event rather than in storage:
    /// it is written once and only ever read by a human checking the claim.
    ///
    /// @dev Permanent by construction. There is no un-breach path, because a
    /// falsifier that can be withdrawn is not a falsifier — it would let the
    /// operator restore a curator's income after the fact, which is exactly the
    /// discretion this design exists to remove.
    function attestBreach(uint256 basketId, bytes32 evidenceHash) external {
        if (msg.sender != attestor) revert OnlyAttestor(msg.sender);
        if (basketId >= baskets.length) revert UnknownBasket(basketId);

        address basket = baskets[basketId];
        if (breached[basket]) revert AlreadyBreached(basket);

        breached[basket] = true;
        breachedAt[basket] = uint64(block.timestamp);
        breachedCountOf[creatorOf[basket]] += 1;

        emit BreachAttested(basket, basketId, evidenceHash, uint64(block.timestamp), msg.sender);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @inheritdoc IArkiv
    function checkMint(address minter, address receiver, uint256 usdgIn) external view {
        if (paused) revert Paused();
        if (usdgIn == 0) revert ZeroAmount();
        if (usdgIn > mintCap) revert AboveMintCap(usdgIn, mintCap);
        if (sanctions.isSanctioned(minter)) revert Sanctioned(minter);
        if (sanctions.isSanctioned(receiver)) revert Sanctioned(receiver);
    }

    /// @notice What a mint of `usdgIn` costs and how much reaches the legs.
    /// @dev The UI reads this to show the fee before the user signs. A fee a
    /// depositor discovers afterwards is a bug even when the maths is right.
    function quoteMintFee(uint256 usdgIn) external view returns (uint256 fee, uint256 netUsdgIn) {
        fee = (usdgIn * feeBps) / BPS;
        netUsdgIn = usdgIn - fee;
    }

    function isAllowed(address wrapper) external view returns (bool) {
        return assetInfo[wrapper].allowed;
    }

    /// @notice Number of baskets ever created. Never decreases — the archive is
    /// append-only and a thesis is never removed from it.
    function basketCount() external view returns (uint256) {
        return baskets.length;
    }

    /// @notice The entire archive, in creation order.
    ///
    /// @dev The archive is a first-class on-chain object, not a view derived by
    /// replaying `BasketCreated` logs. Anyone — our frontend, an explorer, a
    /// third party — can enumerate every thesis ever written with one `eth_call`
    /// and no indexer, and it keeps working on an RPC that caps `eth_getLogs` at
    /// 100 blocks. `BasketCreated` is still emitted for indexers; it is simply
    /// not how state is read.
    ///
    /// Unbounded by design, because the caller can always page instead. Prefer
    /// `getBaskets` once the archive is large.
    function getAllBaskets() external view returns (address[] memory) {
        return baskets;
    }

    /// @notice A page of the archive, newest-agnostic (creation order).
    /// @param offset Index to start at.
    /// @param limit Maximum entries to return.
    /// @return page The slice, truncated at the end of the array rather than
    /// reverting — so a caller paging past the end gets an empty array and stops,
    /// instead of having to check `basketCount()` first and race a new creation.
    function getBaskets(uint256 offset, uint256 limit) external view returns (address[] memory page) {
        uint256 total = baskets.length;
        if (offset >= total) return new address[](0);

        uint256 end = offset + limit;
        if (end > total) end = total;

        page = new address[](end - offset);
        for (uint256 i; i < page.length; ++i) {
            page[i] = baskets[offset + i];
        }
    }

    /// @notice Every basket a curator has authored, in creation order.
    function basketsByCurator(address curator) external view returns (address[] memory) {
        return _authoredBy[curator];
    }

    /// @notice A curator's track record.
    ///
    /// @return authored Baskets written.
    /// @return breachedCount How many have been attested breached.
    /// @return standing How many still stand — authored minus breached.
    ///
    /// @dev Deliberately counts claims, not returns. A return is mostly luck and
    /// mostly the market's; a falsifier that was published in advance and did
    /// not trigger is evidence about the author. Ranking curators by performance
    /// would reward whoever took the most risk in the luckiest quarter.
    ///
    /// "Survived its horizon" is the stronger signal and is NOT computed here:
    /// the horizon lives in the falsifier, off-chain, and putting a date on
    /// chain that nothing enforces would look like a guarantee. The frontend
    /// joins this with the underwriting record to show it.
    function curatorRecord(address curator)
        external
        view
        returns (uint256 authored, uint256 breachedCount, uint256 standing)
    {
        authored = _authoredBy[curator].length;
        breachedCount = breachedCountOf[curator];
        standing = authored - breachedCount;
    }

    /// @dev A base xStock answers `multiplier()` with its rebase factor; a
    /// wrapper reverts. Anything that answers is treated as rebasing.
    function _isRebasing(address token) internal view returns (bool) {
        (bool ok, bytes memory ret) = token.staticcall(abi.encodeWithSignature("multiplier()"));
        return ok && ret.length >= 32;
    }
}
