// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IDexAdapter} from "../../src/interfaces/IDexAdapter.sol";
import {MockERC20} from "./MockERC20.sol";

/// @notice A DEX adapter whose output per leg is dictated by the test, so the
/// share-accounting tests can pin exact numbers instead of inferring them from
/// pool maths.
contract MockDexAdapter is IDexAdapter {
    /// @notice Units of tokenOut delivered per 1 USDG base unit, 18-dp fixed point.
    mapping(address token => uint256) public rate;

    /// @notice When set, overrides `rate` for the next swap of that token.
    mapping(address token => uint256) public forcedOut;

    /// @notice Report a larger amountOut than actually delivered, to prove the
    /// basket ignores the return value and trusts its own measured delta.
    bool public lieAboutOutput;

    function setRate(address token, uint256 unitsPerUsdgBaseUnit) external {
        rate[token] = unitsPerUsdgBaseUnit;
    }

    function setForcedOut(address token, uint256 amount) external {
        forcedOut[token] = amount;
    }

    function setLieAboutOutput(bool value) external {
        lieAboutOutput = value;
    }

    function swapExactInput(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external returns (uint256 amountOut) {
        MockERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);

        amountOut = forcedOut[tokenOut] != 0 ? forcedOut[tokenOut] : (amountIn * rate[tokenOut]) / 1e18;
        forcedOut[tokenOut] = 0;

        require(amountOut >= minAmountOut, "MockDexAdapter: slippage");
        MockERC20(tokenOut).mint(recipient, amountOut);

        if (lieAboutOutput) amountOut = type(uint128).max;
    }
}
