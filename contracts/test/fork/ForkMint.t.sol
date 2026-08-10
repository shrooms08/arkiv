// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Arkiv} from "../../src/Arkiv.sol";
import {Basket} from "../../src/Basket.sol";
import {XLayerV3Adapter} from "../../src/XLayerV3Adapter.sol";
import {XLayerConfig} from "../../src/config/XLayerConfig.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice End-to-end against live X Layer state: real pools, real wrappers,
/// real USDG, real deny-list. Every swap goes through `pool.swap()` and pays in
/// `uniswapV3SwapCallback` — the mechanism, not a stand-in for it.
///
/// The basket is GLDx / NVDAx / SPYx at 30/30/40, which is 70% core. It exercises
/// GLDx counting as core, one tilt leg, and ascending-address ordering across
/// three real tokens.
contract ForkMintTest is Test {
    uint256 internal constant FORK_BLOCK = 67_600_000;

    Arkiv internal arkiv;
    XLayerV3Adapter internal adapter;
    Basket internal basket;

    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    address internal constant USDG = XLayerConfig.USDG;
    address internal gldx = XLayerConfig.W_GLDX;
    address internal nvdax = XLayerConfig.W_NVDAX;
    address internal spyx = XLayerConfig.W_SPYX;

    address[] internal legs;

    function setUp() public {
        string memory rpc = vm.envOr("XLAYER_RPC_URL", string("xlayer"));
        vm.createSelectFork(rpc, FORK_BLOCK);

        adapter = new XLayerV3Adapter(XLayerConfig.V3_FACTORY, XLayerConfig.POOL_INIT_CODE_HASH, owner);

        vm.startPrank(owner);
        adapter.registerPair(USDG, gldx, XLayerConfig.FEE_TIER);
        adapter.registerPair(USDG, nvdax, XLayerConfig.FEE_TIER);
        adapter.registerPair(USDG, spyx, XLayerConfig.FEE_TIER);
        vm.stopPrank();

        arkiv = new Arkiv(
            USDG,
            XLayerConfig.SANCTIONS_LIST,
            address(adapter),
            XLayerConfig.MINT_CAP,
            XLayerConfig.MIN_FIRST_MINT,
            owner
        );

        vm.startPrank(owner);
        arkiv.setAssetAllowed(gldx, true, true); // core
        arkiv.setAssetAllowed(nvdax, true, false); // tilt
        arkiv.setAssetAllowed(spyx, true, true); // core
        vm.stopPrank();

        // Ascending by address: GLDx 0x735f… < NVDAx 0xa8dd… < SPYx 0xE7E5…
        legs = [gldx, nvdax, spyx];
        uint16[] memory weights = new uint16[](3);
        weights[0] = 3000;
        weights[1] = 3000;
        weights[2] = 4000;

        basket = Basket(arkiv.createBasket("Gold, silicon, index", "ARKV1", legs, weights, "ipfs://thesis-1"));
    }

    // -----------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------

    function _fund(address who, uint256 amount) internal {
        deal(USDG, who, amount);
        vm.prank(who);
        IERC20(USDG).approve(address(basket), amount);
    }

    function _split(uint256 usdgIn) internal pure returns (uint256[] memory s) {
        s = new uint256[](3);
        s[0] = (usdgIn * 3000) / 10_000;
        s[1] = (usdgIn * 3000) / 10_000;
        s[2] = usdgIn - s[0] - s[1];
    }

    function _mint(address who, uint256 usdgIn, uint256 minSharesOut) internal returns (uint256) {
        uint256[] memory split = _split(usdgIn);
        uint256[] memory minOut = new uint256[](3);
        _fund(who, usdgIn);
        vm.prank(who);
        return basket.mint(usdgIn, split, minOut, minSharesOut, who);
    }

    // -----------------------------------------------------------------
    // Tests
    // -----------------------------------------------------------------

    function test_fundingWorks() public {
        deal(USDG, alice, 1_000_000_000);
        assertEq(IERC20(USDG).balanceOf(alice), 1_000_000_000, "USDG is 6 decimals: this is $1,000");
    }

    /// @notice A real $1,000 mint: three real swaps, three real callbacks.
    function test_firstMintAgainstRealPools() public {
        uint256 dead = basket.DEAD_SHARES();
        uint256 shares = _mint(alice, 1_000_000_000, 0);

        assertEq(shares, 1000e18 - dead, "$1,000 at the fixed first-mint basis, less dead shares");
        assertEq(basket.balanceOf(alice), 1000e18 - dead);
        assertEq(basket.totalSupply(), 1000e18);

        assertGt(basket.reserves(gldx), 0, "GLDx acquired");
        assertGt(basket.reserves(nvdax), 0, "NVDAx acquired");
        assertGt(basket.reserves(spyx), 0, "SPYx acquired");

        emit log_named_decimal_uint("GLDx  units", basket.reserves(gldx), 18);
        emit log_named_decimal_uint("NVDAx units", basket.reserves(nvdax), 18);
        emit log_named_decimal_uint("SPYx  units", basket.reserves(spyx), 18);

        // Reserves must equal the basket's actual holdings: nothing was left
        // unaccounted and nothing was over-credited.
        assertEq(IERC20(gldx).balanceOf(address(basket)), basket.reserves(gldx));
        assertEq(IERC20(nvdax).balanceOf(address(basket)), basket.reserves(nvdax));
        assertEq(IERC20(spyx).balanceOf(address(basket)), basket.reserves(spyx));

        assertEq(IERC20(USDG).balanceOf(address(basket)), 0, "all USDG was spent");
        assertEq(IERC20(USDG).balanceOf(address(adapter)), 0, "adapter holds nothing");
    }

    /// @notice A second real mint. The worst leg binds and the surplus on the
    /// other legs comes back to the minter in kind.
    function test_secondMintBindsAndRefundsInKind() public {
        _mint(alice, 1_000_000_000, 0);

        (, uint256[] memory unitsBefore) = basket.unitsPerShare();

        uint256 shares = _mint(bob, 1_000_000_000, 0);
        assertGt(shares, 0);

        (, uint256[] memory unitsAfter) = basket.unitsPerShare();
        for (uint256 i; i < 3; ++i) {
            assertGe(unitsAfter[i], unitsBefore[i], "per-share backing never falls");
        }

        // At least one leg is expected to over-deliver relative to the binding
        // leg, and that surplus must be with Bob, not in the vault.
        uint256 refunds;
        for (uint256 i; i < 3; ++i) {
            uint256 refunded = IERC20(legs[i]).balanceOf(bob);
            refunds += refunded;
            // Whatever the basket did not credit, it does not hold.
            assertEq(
                IERC20(legs[i]).balanceOf(address(basket)), basket.reserves(legs[i]), "no surplus stranded in the vault"
            );
        }
        emit log_named_uint("total refunded wei across legs", refunds);
    }

    /// @notice In-kind redemption touches no pool at all.
    function test_redeemInKindAgainstRealTokens() public {
        _mint(alice, 1_000_000_000, 0);

        uint256[] memory preview = basket.previewRedeem(500e18);

        vm.prank(alice);
        uint256[] memory amounts = basket.redeem(500e18, alice, new uint256[](3));

        for (uint256 i; i < 3; ++i) {
            assertEq(amounts[i], preview[i], "redeem matches preview");
            assertEq(IERC20(legs[i]).balanceOf(alice), amounts[i], "paid in kind");
            assertGt(amounts[i], 0);
        }
        assertEq(basket.totalSupply(), 500e18);
    }

    /// @notice R6, against the real rebasing base token: donated, inert.
    function test_donatedRealBaseTokenIsInert() public {
        _mint(alice, 1_000_000_000, 0);

        uint256[] memory before = basket.previewRedeem(1000e18);

        // Take real SPYx base from a real holder and push it into the vault.
        //
        // `deal` cannot be used here, and the reason is the point of the test:
        // the base token rebases, so `balanceOf` is a scaled read of the stored
        // share and stdstore's write-then-verify never matches. The wrapper
        // contract itself is the natural holder — it custodies the base that
        // backs every wrapper token — so the donation comes from there.
        address baseSpy = XLayerConfig.B_SPYX;
        vm.prank(spyx);
        IERC20(baseSpy).transfer(address(basket), 1e18);

        assertEq(basket.reserves(baseSpy), 0, "not credited");
        assertGt(basket.unaccounted(baseSpy), 0, "visible but unclaimable");

        uint256[] memory afterDonation = basket.previewRedeem(1000e18);
        for (uint256 i; i < 3; ++i) {
            assertEq(afterDonation[i], before[i], "redemption unchanged by donation");
        }
    }

    /// @notice `minSharesOut` against real execution: demand more shares than a
    /// $1,000 mint can possibly justify and the mint must revert.
    function test_minSharesOutRejectsUnderShare() public {
        _mint(alice, 1_000_000_000, 0);

        uint256[] memory split = _split(1_000_000_000);
        uint256[] memory minOut = new uint256[](3);
        _fund(bob, 1_000_000_000);

        vm.prank(bob);
        vm.expectRevert();
        basket.mint(1_000_000_000, split, minOut, 2000e18, bob);
    }

    /// @notice THE callback guard, against a real deployed adapter on real chain
    /// state: an EOA calls it directly while the adapter holds real USDG.
    function test_callbackGuardHoldsOnRealChainState() public {
        // Give the adapter something worth stealing.
        deal(USDG, address(adapter), 10_000_000_000);
        uint256 before = IERC20(USDG).balanceOf(address(adapter));
        assertEq(before, 10_000_000_000);

        bytes memory data = abi.encode(USDG, spyx, XLayerConfig.FEE_TIER, uint256(10_000_000_000));

        vm.prank(alice);
        vm.expectRevert(XLayerV3Adapter.NoSwapInProgress.selector);
        adapter.uniswapV3SwapCallback(int256(10_000_000_000), -int256(uint256(1e18)), data);

        assertEq(IERC20(USDG).balanceOf(address(adapter)), before, "nothing was paid out");
        assertEq(IERC20(USDG).balanceOf(alice), 0);
    }

    /// @notice The real pool cannot make the adapter pay outside a swap either.
    function test_realPoolCannotInvokeCallbackOutOfBand() public {
        deal(USDG, address(adapter), 1_000_000_000);
        address pool = XLayerConfig.pools()[2]; // SPYx/USDG

        bytes memory data = abi.encode(USDG, spyx, XLayerConfig.FEE_TIER, uint256(1_000_000_000));

        vm.prank(pool);
        vm.expectRevert(XLayerV3Adapter.NoSwapInProgress.selector);
        adapter.uniswapV3SwapCallback(int256(1_000_000_000), -int256(uint256(1e18)), data);

        assertEq(IERC20(USDG).balanceOf(address(adapter)), 1_000_000_000);
    }

    /// @notice R5, re-derived through the production code path rather than from
    /// a bespoke script: a $5,000 mint at the cap blends well inside the 200 bp
    /// budget. The reference rate for each leg is measured with a $10 trade, then
    /// rolled back, so measuring does not perturb what it measures.
    function test_blendedSlippageAtTheCapIsInsideBudget() public {
        uint256 usdgIn = XLayerConfig.MINT_CAP; // $5,000
        uint256[] memory split = _split(usdgIn);

        // Reference rates, each measured on a pristine fork state.
        uint256[] memory refRate = new uint256[](3); // 1e18-scaled out per USDG unit
        uint256 refSize = 10_000_000; // $10
        for (uint256 i; i < 3; ++i) {
            uint256 snap = vm.snapshotState();
            uint256 out = _rawSwap(legs[i], refSize);
            refRate[i] = (out * 1e18) / refSize;
            vm.revertToState(snap);
        }

        _fund(alice, usdgIn);
        uint256[] memory minOut = new uint256[](3);
        vm.prank(alice);
        basket.mint(usdgIn, split, minOut, 0, alice);

        uint256 weightedBps;
        for (uint256 i; i < 3; ++i) {
            uint256 got = IERC20(legs[i]).balanceOf(address(basket)) + IERC20(legs[i]).balanceOf(alice);
            uint256 actualRate = (got * 1e18) / split[i];

            uint256 bps = actualRate >= refRate[i] ? 0 : ((refRate[i] - actualRate) * 10_000) / refRate[i];
            emit log_named_uint("leg slippage bps", bps);
            weightedBps += bps * split[i];
        }
        weightedBps /= usdgIn;

        emit log_named_uint("blended slippage bps at $5,000", weightedBps);
        assertLt(weightedBps, 200, "inside the 200 bp blended budget");
    }

    /// @dev A bare adapter swap, used only to measure a reference rate.
    function _rawSwap(address token, uint256 amountIn) internal returns (uint256) {
        deal(USDG, address(this), amountIn);
        IERC20(USDG).approve(address(adapter), amountIn);
        uint256 before = IERC20(token).balanceOf(address(this));
        adapter.swapExactInput(USDG, token, amountIn, 0, address(this));
        return IERC20(token).balanceOf(address(this)) - before;
    }
}
