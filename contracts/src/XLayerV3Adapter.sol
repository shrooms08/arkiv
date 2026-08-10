// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

import {IDexAdapter} from "./interfaces/IDexAdapter.sol";
import {IUniswapV3Factory, IUniswapV3Pool, IUniswapV3SwapCallback} from "./interfaces/IUniswapV3.sol";

/// @title XLayerV3Adapter
/// @notice Swaps against the X Layer Uniswap V3 fork by calling `pool.swap()`
/// directly and paying inside `uniswapV3SwapCallback`.
///
/// Why direct-pool rather than a router: canonical Uniswap is not deployed on
/// chain 196, and sampling 20 real swaps on the SPYx/USDG pool surfaced at least
/// six distinct entrypoints, none of which answered `factory()` or `WETH9()`.
/// No audited router could be positively identified, so routing through any of
/// them would put every mint at the mercy of an unidentified 22 KB contract.
/// Calling the pool directly removes the router from the trust set entirely.
/// See docs/FINDINGS.md §4 and docs/RISKS.md R4.
///
/// @dev THE CALLBACK IS THE ATTACK SURFACE. `uniswapV3SwapCallback` is external
/// and, left unguarded, lets anyone call it and make this contract pay out. It
/// carries three independent locks, any one of which is sufficient:
///
///   1. Transient `_activePool` is non-zero only between our `swap()` call and
///      its return, so the callback cannot fire outside a swap we initiated.
///   2. `msg.sender` must equal that exact pool.
///   3. `msg.sender` must equal the CREATE2 address derived from the factory,
///      the token pair and the fee tier — the standard Uniswap
///      `CallbackValidation` check, so a forged pool address in the callback
///      payload cannot name itself.
///
/// Additionally the callback refuses to pay more than the `amountIn` committed
/// to the swap that is currently in flight.
contract XLayerV3Adapter is IDexAdapter, IUniswapV3SwapCallback, Ownable2Step {
    using SafeERC20 for IERC20;

    /// @notice The V3-fork factory that owns every live xStocks/USDG pool.
    address public immutable factory;

    /// @notice keccak256 of the pool creation code.
    /// @dev Gate 1 verified that this fork deploys pools with the CANONICAL
    /// Uniswap V3 init code hash: CREATE2 over (factory, USDG/wSPYx, 500)
    /// reproduces 0x07c40850…2c11 exactly, and `ForkPoolDerivation.t.sol`
    /// asserts the same for all 14 live pools. It is nonetheless a constructor
    /// argument rather than a hardcoded constant, because "the fork matches
    /// canonical" is a measured fact about one deployment, not a law.
    bytes32 public immutable poolInitCodeHash;

    uint160 internal constant MIN_SQRT_RATIO = 4295128739;
    uint160 internal constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342;

    /// @notice Non-zero only while a swap we initiated is in flight (EIP-1153).
    address private transient _activePool;

    /// @notice Registered fee tier per unordered token pair. Zero means unregistered.
    mapping(bytes32 pairKey => uint24 fee) public pairFee;

    error PairNotRegistered(address tokenIn, address tokenOut);
    error PoolNotDeployed(address pool);
    error FactoryDisagrees(address derived, address registered);
    error UnknownFeeTier(uint24 fee);
    error IdenticalTokens();
    error ZeroAddress();
    error AmountTooLarge(uint256 amountIn);
    error ZeroAmount();
    error InsufficientOutput(uint256 amountOut, uint256 minAmountOut);

    /// @dev The four callback rejections. Kept as distinct errors so the guard
    /// tests assert on the specific lock that fired, not merely "it reverted".
    error NoSwapInProgress();
    error UnauthorizedCallback(address caller, address expected);
    error ForgedCallbackPayload(address caller, address derived);
    error NothingOwed();
    error OverpayRequested(uint256 owed, uint256 committed);

    event PairRegistered(address indexed tokenA, address indexed tokenB, uint24 fee, address pool);
    event PairRemoved(address indexed tokenA, address indexed tokenB);
    event Swapped(
        address indexed tokenIn,
        address indexed tokenOut,
        address indexed recipient,
        uint256 amountIn,
        uint256 amountOut
    );

    constructor(address _factory, bytes32 _poolInitCodeHash, address initialOwner) Ownable(initialOwner) {
        if (_factory == address(0)) revert ZeroAddress();
        factory = _factory;
        poolInitCodeHash = _poolInitCodeHash;
    }

    // ---------------------------------------------------------------------
    // Pair registry
    // ---------------------------------------------------------------------

    /// @notice Register the fee tier for a pair, after proving the pool exists.
    /// @dev Belt and braces: the CREATE2-derived address must have code AND the
    /// factory's own `getPool` registry must return that same address. A pool
    /// that fails either check cannot be registered, so by the time the callback
    /// runs, the address it validates against is one the factory has attested to.
    function registerPair(address tokenA, address tokenB, uint24 fee) external onlyOwner {
        if (tokenA == address(0) || tokenB == address(0)) revert ZeroAddress();
        if (tokenA == tokenB) revert IdenticalTokens();
        if (fee == 0) revert UnknownFeeTier(fee);
        if (IUniswapV3Factory(factory).feeAmountTickSpacing(fee) == 0) revert UnknownFeeTier(fee);

        address derived = computePool(tokenA, tokenB, fee);
        if (derived.code.length == 0) revert PoolNotDeployed(derived);

        address registered = IUniswapV3Factory(factory).getPool(tokenA, tokenB, fee);
        if (registered != derived) revert FactoryDisagrees(derived, registered);

        pairFee[_pairKey(tokenA, tokenB)] = fee;
        emit PairRegistered(tokenA, tokenB, fee, derived);
    }

    function removePair(address tokenA, address tokenB) external onlyOwner {
        delete pairFee[_pairKey(tokenA, tokenB)];
        emit PairRemoved(tokenA, tokenB);
    }

    function poolFor(address tokenA, address tokenB) public view returns (address pool, uint24 fee) {
        fee = pairFee[_pairKey(tokenA, tokenB)];
        if (fee == 0) return (address(0), 0);
        pool = computePool(tokenA, tokenB, fee);
    }

    // ---------------------------------------------------------------------
    // Swapping
    // ---------------------------------------------------------------------

    /// @inheritdoc IDexAdapter
    function swapExactInput(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external returns (uint256 amountOut) {
        if (amountIn == 0) revert ZeroAmount();
        if (amountIn > uint256(type(int256).max)) revert AmountTooLarge(amountIn);

        uint24 fee = pairFee[_pairKey(tokenIn, tokenOut)];
        if (fee == 0) revert PairNotRegistered(tokenIn, tokenOut);

        address pool = computePool(tokenIn, tokenOut, fee);
        bool zeroForOne = tokenIn < tokenOut;

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        // Lock: opened immediately before the call, closed immediately after.
        _activePool = pool;
        // casting to 'int256' is safe because amountIn was bounded by
        // type(int256).max above.
        // forge-lint: disable-next-line(unsafe-typecast)
        (int256 amount0, int256 amount1) = IUniswapV3Pool(pool)
            .swap(
                recipient,
                zeroForOne,
                int256(amountIn),
                zeroForOne ? MIN_SQRT_RATIO + 1 : MAX_SQRT_RATIO - 1,
                abi.encode(tokenIn, tokenOut, fee, amountIn)
            );
        _activePool = address(0);

        int256 outDelta = zeroForOne ? amount1 : amount0;
        // casting to 'uint256' is safe because the negation only runs when
        // outDelta < 0, and negating type(int256).min reverts under checked
        // arithmetic rather than wrapping.
        // forge-lint: disable-next-line(unsafe-typecast)
        amountOut = outDelta < 0 ? uint256(-outDelta) : 0;
        if (amountOut < minAmountOut) revert InsufficientOutput(amountOut, minAmountOut);

        // An exact-input swap against an extreme price limit consumes the whole
        // input, but never assume it. Anything left over goes back to the caller
        // so the adapter holds no balance between calls.
        uint256 unspent = IERC20(tokenIn).balanceOf(address(this));
        if (unspent != 0) IERC20(tokenIn).safeTransfer(msg.sender, unspent);

        emit Swapped(tokenIn, tokenOut, recipient, amountIn, amountOut);
    }

    /// @inheritdoc IUniswapV3SwapCallback
    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external {
        // Lock 1: are we inside a swap we started?
        address active = _activePool;
        if (active == address(0)) revert NoSwapInProgress();

        // Lock 2: is the caller the exact pool we called?
        if (msg.sender != active) revert UnauthorizedCallback(msg.sender, active);

        (address tokenIn, address tokenOut, uint24 fee, uint256 committed) =
            abi.decode(data, (address, address, uint24, uint256));

        // Lock 3: does the caller's own address derive from the pair it claims?
        address derived = computePool(tokenIn, tokenOut, fee);
        if (msg.sender != derived) revert ForgedCallbackPayload(msg.sender, derived);

        int256 owedDelta = tokenIn < tokenOut ? amount0Delta : amount1Delta;
        if (owedDelta <= 0) revert NothingOwed();

        // casting to 'uint256' is safe because owedDelta > 0 was just checked.
        // forge-lint: disable-next-line(unsafe-typecast)
        uint256 owed = uint256(owedDelta);
        if (owed > committed) revert OverpayRequested(owed, committed);

        IERC20(tokenIn).safeTransfer(msg.sender, owed);
    }

    // ---------------------------------------------------------------------
    // CREATE2
    // ---------------------------------------------------------------------

    /// @notice The deterministic address of a V3-fork pool.
    function computePool(address tokenA, address tokenB, uint24 fee) public view returns (address) {
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        return address(
            uint160(
                uint256(
                    keccak256(
                        abi.encodePacked(hex"ff", factory, keccak256(abi.encode(token0, token1, fee)), poolInitCodeHash)
                    )
                )
            )
        );
    }

    function _pairKey(address tokenA, address tokenB) internal pure returns (bytes32) {
        return tokenA < tokenB ? keccak256(abi.encode(tokenA, tokenB)) : keccak256(abi.encode(tokenB, tokenA));
    }
}
