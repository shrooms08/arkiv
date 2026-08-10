// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IUniswapV3SwapCallback} from "../../src/interfaces/IUniswapV3.sol";
import {MockERC20} from "./MockERC20.sol";

/// @notice A V3-shaped pool that can also misbehave, so each callback lock can
/// be driven independently.
///
/// @dev NO IMMUTABLES and NO CONSTRUCTOR STATE. Tests place this at the exact
/// CREATE2 address the adapter derives, via `vm.etch` + `init()`. Immutables live
/// in runtime code and would survive `etch`, but constructor-written storage
/// would not, so all configuration is set through `init`.
contract MockV3Pool {
    enum Mode {
        Normal,
        ReenterWithForgedPair, // msg.sender is the real pool, payload names another pair
        Overpay, // ask for more than the swap committed
        DelegateToOutsider // have a third-party contract call the callback mid-swap
    }

    address public token0;
    address public token1;
    uint24 public fee;
    /// @notice tokenOut units delivered per unit of tokenIn, 18-dp fixed point.
    uint256 public rate;
    Mode public mode;
    address public outsider;
    address public forgedTokenA;
    address public forgedTokenB;

    function init(address _token0, address _token1, uint24 _fee, uint256 _rate) external {
        token0 = _token0;
        token1 = _token1;
        fee = _fee;
        rate = _rate;
    }

    function setMode(Mode _mode) external {
        mode = _mode;
    }

    function setOutsider(address _outsider) external {
        outsider = _outsider;
    }

    function setForgedPair(address a, address b) external {
        forgedTokenA = a;
        forgedTokenB = b;
    }

    function swap(address recipient, bool zeroForOne, int256 amountSpecified, uint160, bytes calldata data)
        external
        returns (int256 amount0, int256 amount1)
    {
        uint256 amountIn = uint256(amountSpecified);
        uint256 amountOut = (amountIn * rate) / 1e18;

        address tokenIn = zeroForOne ? token0 : token1;
        address tokenOut = zeroForOne ? token1 : token0;

        MockERC20(tokenOut).mint(recipient, amountOut);

        if (mode == Mode.DelegateToOutsider) {
            // A different contract calls the callback while our lock is open.
            IUniswapV3SwapCallback(outsider).uniswapV3SwapCallback(int256(amountIn), -int256(amountOut), data);
        }

        uint256 request = mode == Mode.Overpay ? amountIn + 1 : amountIn;

        if (zeroForOne) {
            amount0 = int256(request);
            amount1 = -int256(amountOut);
        } else {
            amount0 = -int256(amountOut);
            amount1 = int256(request);
        }

        if (mode == Mode.ReenterWithForgedPair) {
            // Same msg.sender, different pair in the payload: locks 1 and 2 pass,
            // lock 3 must catch it.
            bytes memory forged = abi.encode(forgedTokenA, forgedTokenB, fee, amountIn);
            IUniswapV3SwapCallback(msg.sender).uniswapV3SwapCallback(amount0, amount1, forged);
        } else {
            IUniswapV3SwapCallback(msg.sender).uniswapV3SwapCallback(amount0, amount1, data);
        }

        // The pool keeps whatever it was paid.
        tokenIn; // silence unused warning
    }
}

/// @notice A contract that is not a pool, trying to drain the adapter through
/// its callback.
contract CallbackAttacker {
    address public immutable adapter;

    constructor(address _adapter) {
        adapter = _adapter;
    }

    function attack(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external {
        IUniswapV3SwapCallback(adapter).uniswapV3SwapCallback(amount0Delta, amount1Delta, data);
    }

    /// @dev Used as the `outsider` in MockV3Pool.Mode.DelegateToOutsider: it is
    /// invoked with the pool's own callback arguments and forwards them.
    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external {
        IUniswapV3SwapCallback(adapter).uniswapV3SwapCallback(amount0Delta, amount1Delta, data);
    }
}

/// @notice Minimal factory whose `getPool` the adapter cross-checks at registration.
contract MockV3Factory {
    mapping(address => mapping(address => mapping(uint24 => address))) internal _pools;
    mapping(uint24 => int24) public feeAmountTickSpacing;

    constructor() {
        feeAmountTickSpacing[500] = 10;
        feeAmountTickSpacing[3000] = 60;
    }

    function setPool(address tokenA, address tokenB, uint24 fee, address pool) external {
        _pools[tokenA][tokenB][fee] = pool;
        _pools[tokenB][tokenA][fee] = pool;
    }

    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address) {
        return _pools[tokenA][tokenB][fee];
    }
}
