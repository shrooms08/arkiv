// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {XLayerV3Adapter} from "../src/XLayerV3Adapter.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockV3Pool, MockV3Factory, CallbackAttacker} from "./mocks/MockV3Pool.sol";

/// @notice `uniswapV3SwapCallback` is external and pays out of the adapter's
/// balance. Unguarded, it is a drain vector: anyone calls it and the adapter
/// hands over tokens.
///
/// Every test here funds the adapter FIRST, so a revert proves the guard fired
/// rather than proving the adapter merely had nothing to give.
contract CallbackGuardTest is Test {
    XLayerV3Adapter internal adapter;
    MockV3Factory internal factory;
    MockERC20 internal usdg;
    MockERC20 internal wrapper;
    MockV3Pool internal pool;
    CallbackAttacker internal attacker;

    address internal owner = makeAddr("owner");
    address internal eoa = makeAddr("eoa");

    uint24 internal constant FEE = 500;
    bytes32 internal constant INIT_CODE_HASH = keccak256("mock-pool-init-code");

    /// @notice What the adapter is holding when each guard test runs.
    uint256 internal constant ADAPTER_FUNDS = 1_000e6;

    function setUp() public {
        factory = new MockV3Factory();
        adapter = new XLayerV3Adapter(address(factory), INIT_CODE_HASH, owner);

        usdg = new MockERC20("Global Dollar", "USDG", 6);
        wrapper = new MockERC20("Backed SPY", "wSPYx", 18);

        // Place a working pool at the exact address the adapter derives.
        address derived = adapter.computePool(address(usdg), address(wrapper), FEE);
        MockV3Pool template = new MockV3Pool();
        vm.etch(derived, address(template).code);
        pool = MockV3Pool(derived);

        (address token0, address token1) =
            address(usdg) < address(wrapper) ? (address(usdg), address(wrapper)) : (address(wrapper), address(usdg));
        // 1e30 in 18-dp fixed point: one 6-dp USDG base unit buys 1e12 wrapper
        // base units, i.e. $1 buys one whole 18-dp wrapper token.
        pool.init(token0, token1, FEE, 1e30);

        factory.setPool(address(usdg), address(wrapper), FEE, derived);

        vm.prank(owner);
        adapter.registerPair(address(usdg), address(wrapper), FEE);

        attacker = new CallbackAttacker(address(adapter));

        // The adapter should never hold a balance between swaps. Give it one
        // anyway, so "reverted" cannot be confused with "had nothing to steal".
        usdg.mint(address(adapter), ADAPTER_FUNDS);
    }

    function _payload(uint256 committed) internal view returns (bytes memory) {
        return abi.encode(address(usdg), address(wrapper), FEE, committed);
    }

    // -----------------------------------------------------------------
    // Lock 1 — no swap in progress
    // -----------------------------------------------------------------

    /// @notice THE required test: an EOA calls the callback directly.
    function test_callback_directFromEOA_reverts() public {
        assertEq(usdg.balanceOf(address(adapter)), ADAPTER_FUNDS, "precondition: adapter is funded");

        vm.prank(eoa);
        vm.expectRevert(XLayerV3Adapter.NoSwapInProgress.selector);
        adapter.uniswapV3SwapCallback(int256(ADAPTER_FUNDS), -int256(uint256(1e18)), _payload(ADAPTER_FUNDS));

        assertEq(usdg.balanceOf(address(adapter)), ADAPTER_FUNDS, "adapter paid out nothing");
        assertEq(usdg.balanceOf(eoa), 0, "attacker received nothing");
    }

    /// @notice The same attack from a contract rather than an EOA.
    function test_callback_directFromContract_reverts() public {
        vm.expectRevert(XLayerV3Adapter.NoSwapInProgress.selector);
        attacker.attack(int256(ADAPTER_FUNDS), -int256(uint256(1e18)), _payload(ADAPTER_FUNDS));

        assertEq(usdg.balanceOf(address(adapter)), ADAPTER_FUNDS);
        assertEq(usdg.balanceOf(address(attacker)), 0);
    }

    /// @notice Even the genuine pool cannot call the callback out of band.
    function test_callback_fromRealPoolOutsideSwap_reverts() public {
        vm.prank(address(pool));
        vm.expectRevert(XLayerV3Adapter.NoSwapInProgress.selector);
        adapter.uniswapV3SwapCallback(int256(ADAPTER_FUNDS), -int256(uint256(1e18)), _payload(ADAPTER_FUNDS));

        assertEq(usdg.balanceOf(address(adapter)), ADAPTER_FUNDS);
    }

    /// @notice No caller, of any kind, gets through when no swap is in flight.
    function testFuzz_callback_fromAnyCaller_reverts(address caller, int256 amount0, int256 amount1) public {
        vm.assume(caller != address(0));
        amount0 = bound(amount0, 1, int256(uint256(ADAPTER_FUNDS)));
        amount1 = bound(amount1, 1, int256(uint256(ADAPTER_FUNDS)));

        vm.prank(caller);
        vm.expectRevert(XLayerV3Adapter.NoSwapInProgress.selector);
        adapter.uniswapV3SwapCallback(amount0, amount1, _payload(ADAPTER_FUNDS));

        assertEq(usdg.balanceOf(address(adapter)), ADAPTER_FUNDS);
    }

    /// @notice The lock must close on the way out, not just open on the way in.
    function test_lockIsClearedAfterSuccessfulSwap() public {
        _swap(100e6);

        vm.prank(eoa);
        vm.expectRevert(XLayerV3Adapter.NoSwapInProgress.selector);
        adapter.uniswapV3SwapCallback(int256(uint256(1e6)), -int256(uint256(1e18)), _payload(1e6));
    }

    // -----------------------------------------------------------------
    // Lock 2 — caller is not the pool we are swapping with
    // -----------------------------------------------------------------

    /// @notice An outsider calls the callback WHILE a legitimate swap is open,
    /// which is the only window in which lock 1 would let anything through.
    function test_callback_fromOutsiderDuringSwap_reverts() public {
        pool.setMode(MockV3Pool.Mode.DelegateToOutsider);
        pool.setOutsider(address(attacker));
        _fund(100e6);

        vm.expectRevert(
            abi.encodeWithSelector(XLayerV3Adapter.UnauthorizedCallback.selector, address(attacker), address(pool))
        );
        _swapPrefunded(100e6);
    }

    // -----------------------------------------------------------------
    // Lock 3 — CREATE2 derivation
    // -----------------------------------------------------------------

    /// @notice The pool re-enters with a payload naming a different pair. Locks 1
    /// and 2 both pass — msg.sender really is the active pool — so this is the
    /// case only the CREATE2 check can catch.
    function test_callback_withForgedPairPayload_reverts() public {
        MockERC20 other = new MockERC20("Decoy", "xStocks", 18);
        pool.setMode(MockV3Pool.Mode.ReenterWithForgedPair);
        pool.setForgedPair(address(usdg), address(other));

        address derivedForForgedPair = adapter.computePool(address(usdg), address(other), FEE);
        _fund(100e6);

        vm.expectRevert(
            abi.encodeWithSelector(XLayerV3Adapter.ForgedCallbackPayload.selector, address(pool), derivedForForgedPair)
        );
        _swapPrefunded(100e6);
    }

    // -----------------------------------------------------------------
    // Payment bound
    // -----------------------------------------------------------------

    /// @notice A pool cannot bill more than the swap committed.
    function test_callback_poolCannotRequestMoreThanCommitted() public {
        pool.setMode(MockV3Pool.Mode.Overpay);
        _fund(100e6);

        vm.expectRevert(abi.encodeWithSelector(XLayerV3Adapter.OverpayRequested.selector, 100e6 + 1, 100e6));
        _swapPrefunded(100e6);
    }

    // -----------------------------------------------------------------
    // Registration
    // -----------------------------------------------------------------

    function test_registerPair_revertsWhenFactoryDisagrees() public {
        MockERC20 other = new MockERC20("Other", "OTH", 18);
        address derived = adapter.computePool(address(usdg), address(other), FEE);
        vm.etch(derived, address(new MockV3Pool()).code);

        // Factory points somewhere else entirely.
        factory.setPool(address(usdg), address(other), FEE, address(0xdead));

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(XLayerV3Adapter.FactoryDisagrees.selector, derived, address(0xdead)));
        adapter.registerPair(address(usdg), address(other), FEE);
    }

    function test_registerPair_revertsWhenPoolNotDeployed() public {
        MockERC20 other = new MockERC20("Other", "OTH", 18);
        address derived = adapter.computePool(address(usdg), address(other), FEE);

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(XLayerV3Adapter.PoolNotDeployed.selector, derived));
        adapter.registerPair(address(usdg), address(other), FEE);
    }

    function test_registerPair_onlyOwner() public {
        vm.prank(eoa);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, eoa));
        adapter.registerPair(address(usdg), address(wrapper), FEE);
    }

    function test_swap_revertsForUnregisteredPair() public {
        MockERC20 other = new MockERC20("Other", "OTH", 18);
        vm.expectRevert(
            abi.encodeWithSelector(XLayerV3Adapter.PairNotRegistered.selector, address(usdg), address(other))
        );
        adapter.swapExactInput(address(usdg), address(other), 1e6, 0, address(this));
    }

    // -----------------------------------------------------------------
    // Happy path, for contrast
    // -----------------------------------------------------------------

    function test_swap_succeedsAndLeavesAdapterEmptyOfInput() public {
        uint256 out = _swap(100e6);
        assertEq(out, 100e18, "1e18 rate on a 6-dp input");
        assertEq(wrapper.balanceOf(address(this)), 100e18, "output went to the recipient");
        // The adapter sweeps its whole tokenIn balance back to the caller, so the
        // pre-funded amount comes back too and nothing is stranded.
        assertEq(usdg.balanceOf(address(adapter)), 0, "adapter holds no input between calls");
    }

    /// @dev Funding is separate from swapping so that `vm.expectRevert` binds to
    /// the swap and not to the mint that would otherwise precede it.
    function _fund(uint256 amountIn) internal {
        usdg.mint(address(this), amountIn);
        usdg.approve(address(adapter), amountIn);
    }

    function _swap(uint256 amountIn) internal returns (uint256) {
        _fund(amountIn);
        return adapter.swapExactInput(address(usdg), address(wrapper), amountIn, 0, address(this));
    }

    function _swapPrefunded(uint256 amountIn) internal returns (uint256) {
        return adapter.swapExactInput(address(usdg), address(wrapper), amountIn, 0, address(this));
    }
}
