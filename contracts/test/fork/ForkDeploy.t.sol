// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Deploy} from "../../script/Deploy.s.sol";
import {Arkiv} from "../../src/Arkiv.sol";
import {XLayerV3Adapter} from "../../src/XLayerV3Adapter.sol";
import {XLayerConfig} from "../../src/config/XLayerConfig.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IUniswapV3Factory} from "../../src/interfaces/IUniswapV3.sol";

/// @notice Runs the real deploy script against live chain state, so a mistake in
/// the asset table is caught here rather than on mainnet. Because
/// `registerPair` and `setAssetAllowed` both verify their inputs on-chain, this
/// is a genuine check of the whole config, not a smoke test.
contract ForkDeployTest is Test {
    uint256 internal constant FORK_BLOCK = 67_600_000;

    function setUp() public {
        vm.createSelectFork(vm.envOr("XLAYER_RPC_URL", string("xlayer")), FORK_BLOCK);
    }

    function test_deployScriptWiresTheWholeUniverse() public {
        Deploy deployer = new Deploy();
        (Arkiv arkiv, XLayerV3Adapter adapter,) = deployer.run();

        address[] memory wrappers = XLayerConfig.wrappers();
        address[] memory pools = XLayerConfig.pools();
        bool[] memory isCore = XLayerConfig.isCoreFlags();

        assertEq(arkiv.mintCap(), 5_000_000_000, "$5,000 at six decimals");
        assertEq(address(arkiv.dexAdapter()), address(adapter));

        uint256 coreCount;
        for (uint256 i; i < wrappers.length; ++i) {
            assertTrue(arkiv.isAllowed(wrappers[i]), "allowlisted");

            (bool allowed, bool core) = arkiv.assetInfo(wrappers[i]);
            assertTrue(allowed);
            assertEq(core, isCore[i], "core flag matches the table");
            if (core) ++coreCount;

            (address pool, uint24 fee) = adapter.poolFor(XLayerConfig.USDG, wrappers[i]);
            assertEq(pool, pools[i], "registered pool matches recon");
            assertEq(fee, 500);
        }

        assertEq(coreCount, 4, "GLDx, QQQx, SPYx, IWMx");
    }

    /// @notice The six zero-supply candidates (VTIx, VOOx, SLVx, JPMx, LLYx,
    /// UNHx) are excluded from the allowlist entirely, not merely deprioritised.
    ///
    /// Checked three ways against live state: each is a real deployed wrapper,
    /// each still has zero supply and no USDG pool, and none is allowlisted
    /// after a full deploy.
    function test_zeroSupplyCandidatesAreExcludedNotDeprioritised() public {
        Deploy deployer = new Deploy();
        (Arkiv arkiv, XLayerV3Adapter adapter,) = deployer.run();

        address[] memory excluded = XLayerConfig.excludedWrappers();
        string[] memory names = XLayerConfig.excludedSymbols();

        for (uint256 i; i < excluded.length; ++i) {
            // Real contracts, so this is not a test against dead addresses.
            assertGt(excluded[i].code.length, 0, string.concat(names[i], ": is deployed"));

            assertEq(IERC20(excluded[i]).totalSupply(), 0, string.concat(names[i], ": still zero supply"));
            assertEq(
                IUniswapV3Factory(XLayerConfig.V3_FACTORY)
                    .getPool(XLayerConfig.USDG, excluded[i], XLayerConfig.FEE_TIER),
                address(0),
                string.concat(names[i], ": still no USDG pool")
            );

            assertFalse(arkiv.isAllowed(excluded[i]), string.concat(names[i], ": not allowlisted"));

            (address pool,) = adapter.poolFor(XLayerConfig.USDG, excluded[i]);
            assertEq(pool, address(0), string.concat(names[i], ": no pair registered"));
        }

        // And none of them leaked into the allowlisted universe.
        address[] memory allowed = XLayerConfig.wrappers();
        assertEq(allowed.length, 14, "the universe is exactly 14");
        for (uint256 e; e < excluded.length; ++e) {
            for (uint256 i; i < allowed.length; ++i) {
                assertNotEq(allowed[i], excluded[e], "excluded asset is not in the universe");
            }
        }
    }

    /// @notice One contract per basket is a real cost. Measure it rather than
    /// assume it, so the decision to cap basket creation during the demo is made
    /// against a number.
    function test_basketDeploymentCost() public {
        Deploy deployer = new Deploy();
        (Arkiv arkiv,,) = deployer.run();

        emit log_named_uint("fork basefee (wei)", block.basefee);

        uint256 gas3 = _measureCreate(arkiv, 3);
        uint256 gas8 = _measureCreate(arkiv, 8);

        emit log_named_uint("createBasket gas, 3 legs", gas3);
        emit log_named_uint("createBasket gas, 8 legs", gas8);
        emit log_named_decimal_uint("cost, 3 legs (OKB)", gas3 * block.basefee, 18);
        emit log_named_decimal_uint("cost, 8 legs (OKB)", gas8 * block.basefee, 18);

        // A basket is a full contract deploy; this bounds it well below the
        // 30M block limit so creation can never be the thing that fails.
        assertLt(gas8, 6_000_000, "max-leg basket fits comfortably in a block");
    }

    /// @dev Creates a basket with `legCount` allowlisted legs, ascending, with
    /// enough core weight to clear the floor, and returns the gas used.
    function _measureCreate(Arkiv arkiv, uint256 legCount) internal returns (uint256) {
        address[] memory all = XLayerConfig.wrappers();

        // wrappers() is core-first but not address-sorted; take the first
        // `legCount` and sort them, which keeps all four core assets in any
        // selection of four or more.
        address[] memory tokens = new address[](legCount);
        for (uint256 i; i < legCount; ++i) {
            tokens[i] = all[i];
        }
        for (uint256 i = 1; i < legCount; ++i) {
            address key = tokens[i];
            uint256 j = i;
            while (j > 0 && tokens[j - 1] > key) {
                tokens[j] = tokens[j - 1];
                --j;
            }
            tokens[j] = key;
        }

        // Even weights, remainder onto the first leg. With legCount <= 8 every
        // leg clears 500 bps, and the first four assets are core, so any
        // selection of >= 4 legs clears the 5000 bps core floor.
        uint16[] memory weights = new uint16[](legCount);
        uint16 each = uint16(10_000 / legCount);
        uint16 assigned;
        for (uint256 i = 1; i < legCount; ++i) {
            weights[i] = each;
            assigned += each;
        }
        weights[0] = uint16(10_000 - assigned);

        uint256 before = gasleft();
        arkiv.createBasket("Measured", "ARKM", tokens, weights, "ipfs://measure");
        return before - gasleft();
    }

    /// @notice R6/R2: nothing outside the verified table is allowlisted, and in
    /// particular no rebasing base token is.
    function test_baseTokensAreNeverAllowlisted() public {
        Deploy deployer = new Deploy();
        (Arkiv arkiv,,) = deployer.run();

        assertFalse(arkiv.isAllowed(XLayerConfig.B_SPYX), "base SPYx never allowlisted");
        assertFalse(arkiv.isAllowed(XLayerConfig.B_GLDX));
        assertFalse(arkiv.isAllowed(XLayerConfig.B_NVDAX));

        // And the allowlist would refuse them even if an operator tried: the
        // rebasing probe is a live check, not a static table.
        vm.prank(arkiv.owner());
        vm.expectRevert(abi.encodeWithSelector(Arkiv.RebasingToken.selector, XLayerConfig.B_SPYX));
        arkiv.setAssetAllowed(XLayerConfig.B_SPYX, true, false);
    }
}
