// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {ArkivQuoter} from "../../src/ArkivQuoter.sol";
import {XLayerConfig} from "../../src/config/XLayerConfig.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Exit value, priced off the pools the basket actually redeems into.
contract ForkQuoterTest is Test {
    uint256 internal constant FORK_BLOCK = 67_600_000;

    ArkivQuoter internal quoter;
    address internal constant USDG = XLayerConfig.USDG;

    /// @notice ~$100, the notional the UI should quote at.
    uint256 internal constant NOTIONAL = 100_000_000;

    function setUp() public {
        vm.createSelectFork(vm.envOr("XLAYER_RPC_URL", string("xlayer")), FORK_BLOCK);
        quoter = new ArkivQuoter(XLayerConfig.V3_FACTORY, XLayerConfig.POOL_INIT_CODE_HASH);
    }

    /// @notice Every allowlisted asset must be priceable, or the UI has a hole.
    function test_everyAssetHasAnExitValue() public {
        address[] memory wrappers = XLayerConfig.wrappers();
        string[] memory names = XLayerConfig.symbols();

        for (uint256 i; i < wrappers.length; ++i) {
            // Size the sell to roughly $100 using a buy quote, exactly as the
            // server will.
            uint256 units = quoter.quoteExactInput(USDG, wrappers[i], XLayerConfig.FEE_TIER, NOTIONAL);
            assertGt(units, 0, string.concat(names[i], ": buy quote"));

            uint256 usdgPerUnit = quoter.exitValuePerUnit(wrappers[i], USDG, XLayerConfig.FEE_TIER, units);
            assertGt(usdgPerUnit, 0, string.concat(names[i], ": exit value"));

            emit log_named_decimal_uint(string.concat(names[i], " exit $/unit"), usdgPerUnit, 6);
        }
    }

    /// @notice A $100 round trip must retain most of its value. This is the
    /// check that would catch an inverted pair, a wrong fee tier or a decimals
    /// mistake — all of which produce a plausible-looking non-zero number.
    function test_roundTripRetainsValue() public {
        address[] memory wrappers = XLayerConfig.wrappers();
        string[] memory names = XLayerConfig.symbols();

        for (uint256 i; i < wrappers.length; ++i) {
            uint256 units = quoter.quoteExactInput(USDG, wrappers[i], XLayerConfig.FEE_TIER, NOTIONAL);
            uint256 back = quoter.quoteExactInput(wrappers[i], USDG, XLayerConfig.FEE_TIER, units);

            // Two crossings of a 5 bp fee plus impact at $100 — a few tens of
            // bps in total. Anything below 98% means something is wrong with the
            // pair, not with the market.
            assertGt(back, (NOTIONAL * 98) / 100, string.concat(names[i], ": round trip retains >98%"));
            assertLt(back, NOTIONAL, string.concat(names[i], ": a round trip cannot be profitable"));
        }
    }

    /// @notice Exit value must agree with what a mint actually paid. Gate 1's
    /// $1,000 mint implied GLDx ~$398, NVDAx ~$224, SPYx ~$778; the quoter is a
    /// different code path and must land in the same place.
    function test_exitValueAgreesWithMintImpliedPrices() public {
        uint256 gld = _exitValue(XLayerConfig.W_GLDX);
        uint256 nvda = _exitValue(XLayerConfig.W_NVDAX);
        uint256 spy = _exitValue(XLayerConfig.W_SPYX);

        emit log_named_decimal_uint("GLDx  exit $/unit", gld, 6);
        emit log_named_decimal_uint("NVDAx exit $/unit", nvda, 6);
        emit log_named_decimal_uint("SPYx  exit $/unit", spy, 6);

        // 2% band: the mint figures came from a $1,000 execution across three
        // legs, the quote from a $100 sell, so they should be close but not equal.
        assertApproxEqRel(gld, 398_000_000, 0.02e18, "GLDx");
        assertApproxEqRel(nvda, 224_000_000, 0.02e18, "NVDAx");
        assertApproxEqRel(spy, 778_000_000, 0.02e18, "SPYx");
    }

    /// @notice One dead leg must not blank the whole page.
    function test_batchReturnsZeroForUnquotableLegRatherThanReverting() public {
        address[] memory tokensIn = new address[](2);
        address[] memory tokensOut = new address[](2);
        uint24[] memory fees = new uint24[](2);
        uint256[] memory amounts = new uint256[](2);

        tokensIn[0] = USDG;
        tokensOut[0] = XLayerConfig.W_SPYX;
        fees[0] = XLayerConfig.FEE_TIER;
        amounts[0] = NOTIONAL;

        // An excluded asset: deployed, but with no USDG pool at all.
        tokensIn[1] = USDG;
        tokensOut[1] = XLayerConfig.excludedWrappers()[0];
        fees[1] = XLayerConfig.FEE_TIER;
        amounts[1] = NOTIONAL;

        uint256[] memory out = quoter.quoteExactInputBatch(tokensIn, tokensOut, fees, amounts);

        assertGt(out[0], 0, "live leg quoted");
        assertEq(out[1], 0, "dead leg reported as zero, not a revert");
    }

    /// @notice The quoter's callback is open by design because it can only
    /// revert. Calling it directly must not be able to move anything.
    function test_quoterCallbackOnlyEverReverts() public {
        deal(USDG, address(quoter), 1_000_000_000);

        vm.prank(makeAddr("attacker"));
        vm.expectRevert();
        quoter.uniswapV3SwapCallback(int256(1e18), -int256(1e18), abi.encode(USDG, XLayerConfig.W_SPYX));

        assertEq(IERC20(USDG).balanceOf(address(quoter)), 1_000_000_000, "quoter cannot pay anything out");
    }

    function _exitValue(address wrapper) internal returns (uint256) {
        uint256 units = quoter.quoteExactInput(USDG, wrapper, XLayerConfig.FEE_TIER, NOTIONAL);
        return quoter.exitValuePerUnit(wrapper, USDG, XLayerConfig.FEE_TIER, units);
    }
}
