// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IUniswapV3Pool, IUniswapV3SwapCallback} from "./interfaces/IUniswapV3.sol";

/// @title ArkivQuoter
/// @notice Read-only pricing for the UI. Quotes what a swap WOULD return by
/// executing it against the real pool and reading the answer out of the revert.
///
/// ## What this is for
///
/// A basket's on-chain state is unit counts, not values: `Basket.composition()`
/// reports how many units of each leg back the supply, and takes no view on what
/// a leg is worth. Turning that into the "current composition" number a user
/// reads needs a price, and Pyth is not deployed on X Layer.
///
/// Rather than add an external price feed, price each leg against the pool it
/// actually trades in. The number this produces is **exit value** — what the
/// holder could realise right now — not a reference market price. For a basket
/// that redeems in kind out of these exact pools, exit value is the more honest
/// number: it already contains the depth the user would actually hit.
///
/// Label it as such in the UI. It will differ from the equity's quoted price,
/// and that difference is real information, not an error.
///
/// ## Why this callback needs no guard, unlike the adapter's
///
/// `XLayerV3Adapter.uniswapV3SwapCallback` pays out of the adapter's balance and
/// is therefore a drain vector requiring three locks. **This callback always
/// reverts.** It never transfers anything, this contract never holds a balance
/// and never grants an allowance, so there is nothing for an attacker to
/// extract by calling it. Every swap it initiates is unwound by construction.
///
/// ## Calling convention
///
/// The quote functions are non-`view` because they call `swap`, but they cannot
/// change state — the swap always reverts. Call them with `eth_call` and never
/// in a transaction. Manipulation is not a concern: this is display only, and
/// anyone who moves a pool to distort it is distorting their own screen.
contract ArkivQuoter is IUniswapV3SwapCallback {
    address public immutable factory;
    bytes32 public immutable poolInitCodeHash;

    uint160 internal constant MIN_SQRT_RATIO = 4295128739;
    uint160 internal constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342;

    error UnexpectedQuoteSuccess();

    constructor(address _factory, bytes32 _poolInitCodeHash) {
        factory = _factory;
        poolInitCodeHash = _poolInitCodeHash;
    }

    /// @notice What `amountIn` of `tokenIn` would return in `tokenOut`.
    /// @return amountOut Zero if the pool does not exist or cannot fill.
    function quoteExactInput(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn)
        public
        returns (uint256 amountOut)
    {
        if (amountIn == 0 || amountIn > uint256(type(int256).max)) return 0;

        address pool = computePool(tokenIn, tokenOut, fee);
        if (pool.code.length == 0) return 0;

        bool zeroForOne = tokenIn < tokenOut;

        // forge-lint: disable-next-line(unsafe-typecast)
        try IUniswapV3Pool(pool)
            .swap(
                address(this),
                zeroForOne,
                int256(amountIn),
                zeroForOne ? MIN_SQRT_RATIO + 1 : MAX_SQRT_RATIO - 1,
                abi.encode(tokenIn, tokenOut)
            ) returns (
            int256, int256
        ) {
            // The callback reverts unconditionally, so reaching here means the
            // pool did not call it — not a pool we understand.
            revert UnexpectedQuoteSuccess();
        } catch (bytes memory reason) {
            return _decodeQuote(reason);
        }
    }

    /// @notice Many quotes in one `eth_call`. A leg that cannot be quoted comes
    /// back as zero rather than reverting the whole batch, so one dead pool
    /// cannot blank an entire page.
    function quoteExactInputBatch(
        address[] calldata tokensIn,
        address[] calldata tokensOut,
        uint24[] calldata fees,
        uint256[] calldata amountsIn
    ) external returns (uint256[] memory amountsOut) {
        uint256 n = tokensIn.length;
        require(tokensOut.length == n && fees.length == n && amountsIn.length == n, "ArkivQuoter: length mismatch");

        amountsOut = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            try this.quoteExactInput(tokensIn[i], tokensOut[i], fees[i], amountsIn[i]) returns (uint256 out) {
                amountsOut[i] = out;
            } catch {
                amountsOut[i] = 0;
            }
        }
    }

    /// @notice Exit value of one whole unit (1e18) of `token`, in USDG base
    /// units, measured by selling `unitsToQuote` of it.
    /// @dev The caller sizes `unitsToQuote` to a small notional — roughly $100 —
    /// so the figure reflects a realistic exit rather than either a dust trade
    /// or a market-moving one. Sizing lives off-chain deliberately: it needs a
    /// prior price estimate, and baking a round-trip heuristic in here would
    /// double-count the spread.
    function exitValuePerUnit(address token, address usdg, uint24 fee, uint256 unitsToQuote)
        external
        returns (uint256 usdgPerUnit)
    {
        if (unitsToQuote == 0) return 0;
        uint256 usdgOut = quoteExactInput(token, usdg, fee, unitsToQuote);
        return (usdgOut * 1e18) / unitsToQuote;
    }

    /// @inheritdoc IUniswapV3SwapCallback
    /// @dev Always reverts, carrying the output amount as its revert data. This
    /// is what makes the quote read-only, and it is why the function is safe to
    /// leave open: it can only ever undo the swap that called it.
    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external pure {
        (address tokenIn, address tokenOut) = abi.decode(data, (address, address));

        int256 outDelta = tokenIn < tokenOut ? amount1Delta : amount0Delta;
        // forge-lint: disable-next-line(unsafe-typecast)
        uint256 amountOut = outDelta < 0 ? uint256(-outDelta) : 0;

        assembly ("memory-safe") {
            let ptr := mload(0x40)
            mstore(ptr, amountOut)
            revert(ptr, 32)
        }
    }

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

    /// @dev Our own callback reverts with exactly 32 bytes. Anything else is a
    /// real failure from the pool — no liquidity, bad tick range — and is
    /// reported as an unquotable leg rather than guessed at.
    function _decodeQuote(bytes memory reason) internal pure returns (uint256) {
        if (reason.length != 32) return 0;
        return abi.decode(reason, (uint256));
    }
}
