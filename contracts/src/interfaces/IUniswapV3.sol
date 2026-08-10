// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice The X Layer V3 fork's factory. Canonical Uniswap is NOT deployed on
/// chain 196; this factory (0x4B2ab38DBF28D31D467aA8993f6c2585981D6804) owns
/// every live xStocks/USDG pool. See docs/FINDINGS.md §4.
interface IUniswapV3Factory {
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool);
    function feeAmountTickSpacing(uint24 fee) external view returns (int24);
}

interface IUniswapV3Pool {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function fee() external view returns (uint24);

    function swap(
        address recipient,
        bool zeroForOne,
        int256 amountSpecified,
        uint160 sqrtPriceLimitX96,
        bytes calldata data
    ) external returns (int256 amount0, int256 amount1);
}

interface IUniswapV3SwapCallback {
    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external;
}
