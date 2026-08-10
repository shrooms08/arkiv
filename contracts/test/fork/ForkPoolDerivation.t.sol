// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {XLayerV3Adapter} from "../../src/XLayerV3Adapter.sol";
import {XLayerConfig} from "../../src/config/XLayerConfig.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IUniswapV3Factory, IUniswapV3Pool} from "../../src/interfaces/IUniswapV3.sol";
import {ISanctionsList} from "../../src/interfaces/ISanctionsList.sol";

/// @notice Establishes, against live chain 196, the facts the adapter's callback
/// guard depends on:
///
///   1. Every pool address CREATE2-derives from (factory, pair, fee) using the
///      CANONICAL Uniswap V3 init code hash. This fork did not change the pool
///      contract. That is what makes lock 3 possible at all — without it there
///      would be no way to check a callback's caller without trusting a stored
///      address.
///   2. The factory's own registry agrees with the derivation, for all 14.
///   3. The Gate 0 recon addresses agree with both.
///
/// It also re-checks the token properties Arkiv relies on: USDG at 6 decimals,
/// wrappers that refuse `multiplier()`, bases that answer it.
contract ForkPoolDerivationTest is Test {
    /// @dev Pinned. The public RPC served state here on 2026-08-10; re-pin if it
    /// prunes. Gate 0 measured at ~67,608,000.
    uint256 internal constant FORK_BLOCK = 67_600_000;

    XLayerV3Adapter internal adapter;

    function setUp() public {
        // An explicit URL when one is supplied; otherwise the "xlayer" alias, so
        // the retry and rate-limit settings in foundry.toml apply to the public
        // endpoint. `createSelectFork` accepts either form.
        string memory rpc = vm.envOr("XLAYER_RPC_URL", string("xlayer"));
        vm.createSelectFork(rpc, FORK_BLOCK);
        adapter = new XLayerV3Adapter(XLayerConfig.V3_FACTORY, XLayerConfig.POOL_INIT_CODE_HASH, address(this));
    }

    function test_chainIsXLayer() public view {
        assertEq(block.chainid, XLayerConfig.CHAIN_ID);
    }

    /// @notice USDG is SIX decimals. The $5,000 cap is 5_000_000_000, not 5000e18.
    function test_usdgHasSixDecimals() public view {
        assertEq(IERC20Metadata(XLayerConfig.USDG).decimals(), 6);
        assertEq(XLayerConfig.MINT_CAP, 5_000_000_000);
    }

    /// @notice The load-bearing fact for lock 3, across the whole universe.
    function test_allFourteenPoolsDeriveFromCanonicalInitCodeHash() public view {
        address[] memory wrappers = XLayerConfig.wrappers();
        address[] memory expected = XLayerConfig.pools();
        string[] memory names = XLayerConfig.symbols();

        for (uint256 i; i < wrappers.length; ++i) {
            address derived = adapter.computePool(XLayerConfig.USDG, wrappers[i], XLayerConfig.FEE_TIER);
            assertEq(derived, expected[i], string.concat(names[i], ": CREATE2 derivation matches recon"));
            assertGt(derived.code.length, 0, string.concat(names[i], ": pool is deployed"));
        }
    }

    function test_allFourteenPoolsAgreeWithFactoryRegistry() public view {
        address[] memory wrappers = XLayerConfig.wrappers();
        address[] memory expected = XLayerConfig.pools();
        string[] memory names = XLayerConfig.symbols();

        for (uint256 i; i < wrappers.length; ++i) {
            address registered = IUniswapV3Factory(XLayerConfig.V3_FACTORY)
                .getPool(XLayerConfig.USDG, wrappers[i], XLayerConfig.FEE_TIER);
            assertEq(registered, expected[i], string.concat(names[i], ": factory.getPool matches"));
        }
    }

    function test_everyPoolIsTheUsdgPairOnTheFiveBpTier() public view {
        address[] memory wrappers = XLayerConfig.wrappers();
        address[] memory pools = XLayerConfig.pools();
        string[] memory names = XLayerConfig.symbols();

        for (uint256 i; i < pools.length; ++i) {
            IUniswapV3Pool pool = IUniswapV3Pool(pools[i]);
            address token0 = pool.token0();
            address token1 = pool.token1();

            bool pairsUsdg = token0 == XLayerConfig.USDG || token1 == XLayerConfig.USDG;
            bool pairsWrapper = token0 == wrappers[i] || token1 == wrappers[i];

            assertTrue(pairsUsdg, string.concat(names[i], ": pairs USDG"));
            assertTrue(pairsWrapper, string.concat(names[i], ": pairs the wrapper"));
            assertEq(pool.fee(), XLayerConfig.FEE_TIER, string.concat(names[i], ": 0.05% tier"));
        }
    }

    /// @notice Registration proves the pool twice — derivation and factory —
    /// so it must succeed for all 14 live pairs.
    function test_everyPairCanBeRegistered() public {
        address[] memory wrappers = XLayerConfig.wrappers();
        address[] memory pools = XLayerConfig.pools();

        for (uint256 i; i < wrappers.length; ++i) {
            adapter.registerPair(XLayerConfig.USDG, wrappers[i], XLayerConfig.FEE_TIER);
            (address pool, uint24 fee) = adapter.poolFor(XLayerConfig.USDG, wrappers[i]);
            assertEq(pool, pools[i]);
            assertEq(fee, XLayerConfig.FEE_TIER);
        }
    }

    /// @notice R6: every wrapper refuses `multiplier()`. This is the property
    /// Arkiv's allowlist probe relies on to keep rebasing tokens out.
    function test_everyWrapperRefusesMultiplier() public view {
        address[] memory wrappers = XLayerConfig.wrappers();
        string[] memory names = XLayerConfig.symbols();

        for (uint256 i; i < wrappers.length; ++i) {
            (bool ok, bytes memory ret) = wrappers[i].staticcall(abi.encodeWithSignature("multiplier()"));
            assertFalse(ok && ret.length >= 32, string.concat(names[i], ": wrapper does not rebase"));
        }
    }

    /// @notice And the bases do answer it — so the probe discriminates rather
    /// than trivially passing everything.
    function test_baseTokensDoAnswerMultiplier() public view {
        address[] memory bases = new address[](3);
        bases[0] = XLayerConfig.B_GLDX;
        bases[1] = XLayerConfig.B_SPYX;
        bases[2] = XLayerConfig.B_NVDAX;

        for (uint256 i; i < bases.length; ++i) {
            (bool ok, bytes memory ret) = bases[i].staticcall(abi.encodeWithSignature("multiplier()"));
            assertTrue(ok && ret.length >= 32, "base token rebases");
            assertGt(abi.decode(ret, (uint256)), 0);
        }
    }

    /// @notice R3: the deny-list is live and callable, so Arkiv can read it itself.
    function test_sanctionsListIsCallable() public view {
        assertFalse(ISanctionsList(XLayerConfig.SANCTIONS_LIST).isSanctioned(address(this)));
        assertGt(XLayerConfig.SANCTIONS_LIST.code.length, 0);
    }

    /// @notice Canonical Uniswap really is absent — the reason for the fork
    /// factory and for direct-pool swapping in the first place.
    function test_canonicalUniswapIsAbsent() public view {
        assertEq(address(0x1F98431c8aD98523631AE4a59f267346ea31F984).code.length, 0, "no canonical V3 factory");
        assertEq(address(0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45).code.length, 0, "no SwapRouter02");
        assertGt(XLayerConfig.V3_FACTORY.code.length, 0, "the fork factory is deployed");
    }
}
