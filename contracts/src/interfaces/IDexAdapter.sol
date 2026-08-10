// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IDexAdapter {
    /// @notice Swap an exact amount of `tokenIn` into `tokenOut`, delivering the
    /// output directly to `recipient`.
    /// @dev The caller MUST NOT trust `amountOut`. Arkiv baskets measure their own
    /// `balanceOf` delta and use that. The return value is advisory only; it exists
    /// so the adapter can enforce its own floor and so callers can log it.
    function swapExactInput(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external returns (uint256 amountOut);
}
