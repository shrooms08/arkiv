// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

import {IArkiv} from "./interfaces/IArkiv.sol";
import {IDexAdapter} from "./interfaces/IDexAdapter.sol";
import {ISanctionsList} from "./interfaces/ISanctionsList.sol";
import {Basket} from "./Basket.sol";

/// @title Arkiv
/// @notice Registry and factory. Holds the asset allowlist, the mint cap, the
/// DEX adapter and the pause switch; deploys baskets and enforces the
/// composition rules at creation time.
///
/// Basket creation is permissionless. Every constraint that matters is checked
/// on-chain here, so there is nothing an untrusted creator can smuggle past —
/// and the archive is more honest if it records what people actually believed
/// rather than what an operator approved.
contract Arkiv is IArkiv, Ownable2Step {
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
    /// @dev Only the floor is enforced on-chain. The 6000 bps ceiling in
    /// src/config/assets.ts is an expression band for the underwriter, not a
    /// safety property — a basket that is 100% index is less risky, not more,
    /// and the vault has no business rejecting it.
    uint256 public constant MIN_CORE_BPS = 5000;

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

    address[] public baskets;
    mapping(address => bool) public isBasket;

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

    event AssetSet(address indexed wrapper, bool allowed, bool isCore);
    event DexAdapterSet(address indexed previous, address indexed next);
    event MintCapSet(uint256 previous, uint256 next);
    event MinFirstMintSet(uint256 previous, uint256 next);
    event PausedSet(bool paused);
    event BasketCreated(
        address indexed basket,
        address indexed creator,
        string name,
        string symbol,
        address[] tokens,
        uint16[] thesisWeightsBps,
        string thesisURI
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
        emit DexAdapterSet(address(0), _dexAdapter);
        emit MintCapSet(0, _mintCap);
        emit MinFirstMintSet(0, _minFirstMint);
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

        emit BasketCreated(basket, msg.sender, name, symbol, tokens, thesisWeightsBps, thesisURI);
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

    function isAllowed(address wrapper) external view returns (bool) {
        return assetInfo[wrapper].allowed;
    }

    function basketCount() external view returns (uint256) {
        return baskets.length;
    }

    function allBaskets() external view returns (address[] memory) {
        return baskets;
    }

    /// @dev A base xStock answers `multiplier()` with its rebase factor; a
    /// wrapper reverts. Anything that answers is treated as rebasing.
    function _isRebasing(address token) internal view returns (bool) {
        (bool ok, bytes memory ret) = token.staticcall(abi.encodeWithSignature("multiplier()"));
        return ok && ret.length >= 32;
    }
}
