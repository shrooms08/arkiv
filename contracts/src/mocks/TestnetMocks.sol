// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IDexAdapter} from "../interfaces/IDexAdapter.sol";

/**
 * DEPLOYABLE MOCKS — these ship to X Layer testnet.
 *
 * The real xStocks wrappers, USDG and V3-fork pools exist only on mainnet, so
 * testnet would otherwise be a dead page. These stand in for them so the
 * mechanism — create a basket, mint through an adapter, hold shares, redeem in
 * kind — can be clicked through by anyone without holding anything real.
 *
 * They are mocks and the UI says so on every page. What they faithfully
 * reproduce is the SHAPE the protocol depends on: 6-decimal USDG, 18-decimal
 * non-rebasing wrappers that revert on `multiplier()`, an adapter that delivers
 * tokens the vault must measure rather than trust. What they do not reproduce is
 * price discovery, real liquidity, or any claim on a real asset.
 */

/// @notice Stand-in for Global Dollar. SIX decimals, like the real thing — the
/// decimals are the single most load-bearing property to get right.
contract MockUSDG is ERC20 {
    uint256 public constant FAUCET_AMOUNT = 10_000_000_000; // $10,000

    error FaucetCooldown(uint256 availableAt);

    mapping(address => uint256) public lastFaucet;

    constructor() ERC20("Mock Global Dollar", "mUSDG") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Anyone can fund themselves. Rate-limited so one visitor cannot
    /// drain the demo's credibility by minting absurd balances.
    function faucet() external {
        uint256 last = lastFaucet[msg.sender];
        if (last != 0 && block.timestamp < last + 1 hours) {
            revert FaucetCooldown(last + 1 hours);
        }
        lastFaucet[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
    }
}

/**
 * @notice Stand-in for an xStocks wrapper.
 *
 * @dev Deliberately does NOT implement `multiplier()`. Arkiv's allowlist probes
 * for that function and refuses anything that answers, because the real xStocks
 * *base* tokens rebase and must never enter the vault. A mock that answered
 * would be rejected by `setAssetAllowed` — so this mock has to get the property
 * right for the deployment to work at all, which is a nice property for a mock
 * to have.
 */
contract MockWrapper is ERC20 {
    address public immutable minter;

    error OnlyMinter();

    constructor(string memory name_, string memory symbol_, address minter_) ERC20(name_, symbol_) {
        minter = minter_;
    }

    function mint(address to, uint256 amount) external {
        if (msg.sender != minter) revert OnlyMinter();
        _mint(to, amount);
    }
}

/// @notice Deny-list that denies nobody. Present so the mint path exercises the
/// same external call it makes on mainnet.
contract MockSanctionsList {
    mapping(address => bool) public sanctioned;

    function set(address account, bool value) external {
        sanctioned[account] = value;
    }

    function isSanctioned(address account) external view returns (bool) {
        return sanctioned[account];
    }
}

/**
 * @notice Fixed-rate swap adapter.
 *
 * Takes USDG and mints the destination wrapper at a configured rate. No pools,
 * no slippage, no price impact — the numbers on testnet are stable by design so
 * the demo is legible.
 *
 * The vault still measures its own `balanceOf` delta rather than trusting this
 * adapter's return value, exactly as it does on mainnet. That invariant is not
 * relaxed for the mock.
 */
contract MockDexAdapter is IDexAdapter {
    using SafeERC20 for IERC20;

    address public immutable usdg;
    address public immutable owner;

    /// @notice Wrapper units delivered per USDG base unit, 18-dp fixed point.
    mapping(address token => uint256) public rate;

    error OnlyOwner();
    error NoRate(address token);
    error InsufficientOutput(uint256 amountOut, uint256 minAmountOut);

    constructor(address _usdg, address _owner) {
        usdg = _usdg;
        owner = _owner;
    }

    function setRate(address token, uint256 unitsPerUsdgBaseUnit) external {
        if (msg.sender != owner) revert OnlyOwner();
        rate[token] = unitsPerUsdgBaseUnit;
    }

    /// @inheritdoc IDexAdapter
    function swapExactInput(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external returns (uint256 amountOut) {
        uint256 r = rate[tokenOut];
        if (r == 0) revert NoRate(tokenOut);

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        amountOut = (amountIn * r) / 1e18;
        if (amountOut < minAmountOut) revert InsufficientOutput(amountOut, minAmountOut);

        MockWrapper(tokenOut).mint(recipient, amountOut);
    }
}
