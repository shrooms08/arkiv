// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Vm} from "forge-std/Vm.sol";
import {ArkivFixture} from "./Fixtures.sol";
import {Arkiv} from "../src/Arkiv.sol";
import {Basket} from "../src/Basket.sol";
import {MockERC20, MockRebasingToken} from "./mocks/MockERC20.sol";

/// @notice Share accounting: `shares = S * min_i(d_i / B_i)`, in-kind refund of
/// the excess, and the invariant that no mint may dilute the per-share backing.
contract BasketAccountingTest is ArkivFixture {
    Basket internal basket;
    address internal core; // wrappers[0], 60%
    address internal tilt; // wrappers[4], 40%

    /// @notice $1,000, well inside the $5,000 cap.
    uint256 internal constant MINT_USDG = 1_000_000_000;

    function setUp() public {
        setUpArkiv();
        basket = _createDefaultBasket();
        core = wrappers[0];
        tilt = wrappers[4];
    }

    // -----------------------------------------------------------------
    // First mint
    // -----------------------------------------------------------------

    /// @notice The first mint takes a fixed basis, not a ratio: 1 share ≈ $1.
    /// The first minter pays for the dead shares, Uniswap-V2 style.
    function test_firstMint_takesFixedBasis() public {
        uint256 dead = basket.DEAD_SHARES();
        uint256 shares = _mintAtWeights(basket, alice, MINT_USDG, 0);

        assertEq(shares, 1000e18 - dead, "$1,000 becomes 1,000 shares, less the dead shares");
        assertEq(basket.totalSupply(), 1000e18);
        assertEq(basket.balanceOf(alice), 1000e18 - dead);
        assertEq(basket.balanceOf(basket.DEAD_ADDRESS()), dead, "dead shares are unspendable");

        assertEq(basket.reserves(core), 600e18, "60% of $1,000 at $1/token");
        assertEq(basket.reserves(tilt), 400e18);
    }

    function test_firstMint_revertsBelowTheMinimum() public {
        uint256 tooSmall = MIN_FIRST_MINT - 1;
        uint256[] memory split = _splitAtWeights(basket, tooSmall);
        _fundAndApprove(alice, basket, tooSmall);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Basket.BelowMinimumFirstMint.selector, tooSmall, MIN_FIRST_MINT));
        basket.mint(tooSmall, split, _zeros(2), 0, alice);
    }

    /// @notice The floor applies only to the FIRST mint. Once a basket has a
    /// basis, small mints are fine.
    function test_minimumAppliesOnlyToTheFirstMint() public {
        _mintAtWeights(basket, alice, MIN_FIRST_MINT, 0);
        uint256 shares = _mintAtWeights(basket, bob, 2_000_000, 0); // $2
        assertGt(shares, 0);
    }

    /// @notice Nothing is refunded on the first mint: everything received
    /// becomes reserve, because there is no ratio to bind against.
    function test_firstMint_refundsNothing() public {
        _mintAtWeights(basket, alice, MINT_USDG, 0);

        assertEq(MockERC20(core).balanceOf(alice), 0);
        assertEq(MockERC20(tilt).balanceOf(alice), 0);
    }

    function test_firstMint_revertsIfAnyLegDeliversNothing() public {
        adapter.setRate(tilt, 0);

        uint256[] memory split = _splitAtWeights(basket, MINT_USDG);
        uint256[] memory minOut = _zeros(2);
        _fundAndApprove(alice, basket, MINT_USDG);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Basket.EmptyLeg.selector, tilt));
        basket.mint(MINT_USDG, split, minOut, 0, alice);
    }

    // -----------------------------------------------------------------
    // Min-ratio
    // -----------------------------------------------------------------

    function test_secondMint_atUnchangedRatesIsProportional() public {
        _mintAtWeights(basket, alice, MINT_USDG, 0);
        uint256 shares = _mintAtWeights(basket, bob, MINT_USDG, 0);

        assertEq(shares, 1000e18);
        assertEq(basket.totalSupply(), 2000e18);
        assertEq(basket.reserves(core), 1200e18);
        assertEq(basket.reserves(tilt), 800e18);
    }

    /// @notice The worst leg sets the share count. Here the core leg delivers
    /// 20% less than par while the tilt leg delivers exactly par, so the share
    /// count is bounded at 80% and the core leg is reported as binding.
    function test_secondMint_worstLegBindsShareCount() public {
        _mintAtWeights(basket, alice, MINT_USDG, 0);

        adapter.setForcedOut(core, 480e18); // par would be 600e18
        // tilt delivers its par 400e18

        vm.recordLogs();
        uint256 shares = _mintAtWeights(basket, bob, MINT_USDG, 0);

        assertEq(shares, 800e18, "bounded by the core leg at 480/600 = 80%");
        assertEq(_bindingTokenFromLogs(), core, "the binding leg is reported");
    }

    /// @notice The non-binding leg over-delivered relative to the share count.
    /// That excess goes back to the minter rather than being donated to existing
    /// holders.
    function test_secondMint_refundsExcessInKind() public {
        _mintAtWeights(basket, alice, MINT_USDG, 0);

        adapter.setForcedOut(core, 480e18);
        _mintAtWeights(basket, bob, MINT_USDG, 0);

        // used_tilt = ceil(400e18 * 800e18 / 1000e18) = 320e18, of 400e18 received.
        assertEq(MockERC20(tilt).balanceOf(bob), 80e18, "excess tilt returned in kind");
        assertEq(MockERC20(core).balanceOf(bob), 0, "binding leg has no excess");

        assertEq(basket.reserves(core), 1080e18);
        assertEq(basket.reserves(tilt), 720e18);
    }

    /// @notice The refund must follow the money, not the shares.
    function test_refundGoesToPayerNotShareReceiver() public {
        _mintAtWeights(basket, alice, MINT_USDG, 0);

        adapter.setForcedOut(core, 480e18);

        uint256[] memory split = _splitAtWeights(basket, MINT_USDG);
        uint256[] memory minOut = _zeros(2);
        _fundAndApprove(bob, basket, MINT_USDG);

        vm.prank(bob);
        basket.mint(MINT_USDG, split, minOut, 0, alice); // bob pays, alice receives shares

        assertEq(basket.balanceOf(alice), 1800e18 - basket.DEAD_SHARES(), "alice got the shares");
        assertEq(MockERC20(tilt).balanceOf(bob), 80e18, "bob got the refund");
        assertEq(MockERC20(tilt).balanceOf(alice), 0);
    }

    /// @notice Per-share backing must never fall as a result of a mint. This is
    /// what `used_i = ceil(B_i * shares / S)` buys: rounding goes to the basket.
    function test_mintNeverDilutesPerShareBacking() public {
        _mintAtWeights(basket, alice, MINT_USDG, 0);

        uint256 reserveBefore = basket.reserves(tilt);
        uint256 supplyBefore = basket.totalSupply();

        adapter.setForcedOut(core, 480e18 + 7); // deliberately not a round ratio
        _mintAtWeights(basket, bob, MINT_USDG, 0);

        uint256 reserveAfter = basket.reserves(tilt);
        uint256 supplyAfter = basket.totalSupply();

        assertGe(reserveAfter * supplyBefore, reserveBefore * supplyAfter, "backing per share did not decrease");
    }

    function testFuzz_mintNeverDilutesPerShareBacking(uint256 coreOut, uint256 tiltOut) public {
        _mintAtWeights(basket, alice, MINT_USDG, 0);

        coreOut = bound(coreOut, 1e12, 10_000e18);
        tiltOut = bound(tiltOut, 1e12, 10_000e18);

        uint256 coreBefore = basket.reserves(core);
        uint256 tiltBefore = basket.reserves(tilt);
        uint256 supplyBefore = basket.totalSupply();

        adapter.setForcedOut(core, coreOut);
        adapter.setForcedOut(tilt, tiltOut);

        uint256[] memory split = _splitAtWeights(basket, MINT_USDG);
        uint256[] memory minOut = _zeros(2);
        _fundAndApprove(bob, basket, MINT_USDG);

        vm.prank(bob);
        uint256 shares = basket.mint(MINT_USDG, split, minOut, 0, bob);
        vm.assume(shares > 0);

        uint256 supplyAfter = basket.totalSupply();
        assertGe(basket.reserves(core) * supplyBefore, coreBefore * supplyAfter, "core backing preserved");
        assertGe(basket.reserves(tilt) * supplyBefore, tiltBefore * supplyAfter, "tilt backing preserved");
    }

    /// @notice Shares may never exceed what the worst leg justifies.
    function testFuzz_sharesNeverExceedWorstLegRatio(uint256 coreOut, uint256 tiltOut) public {
        _mintAtWeights(basket, alice, MINT_USDG, 0);

        coreOut = bound(coreOut, 1e12, 10_000e18);
        tiltOut = bound(tiltOut, 1e12, 10_000e18);

        uint256 supplyBefore = basket.totalSupply();
        uint256 coreRatio = (supplyBefore * coreOut) / basket.reserves(core);
        uint256 tiltRatio = (supplyBefore * tiltOut) / basket.reserves(tilt);
        uint256 expected = coreRatio < tiltRatio ? coreRatio : tiltRatio;

        adapter.setForcedOut(core, coreOut);
        adapter.setForcedOut(tilt, tiltOut);

        uint256[] memory split = _splitAtWeights(basket, MINT_USDG);
        uint256[] memory minOut = _zeros(2);
        _fundAndApprove(bob, basket, MINT_USDG);

        vm.prank(bob);
        uint256 shares = basket.mint(MINT_USDG, split, minOut, 0, bob);

        assertEq(shares, expected, "shares equal the minimum leg ratio exactly");
    }

    // -----------------------------------------------------------------
    // minSharesOut
    // -----------------------------------------------------------------

    /// @notice The case that motivates `minSharesOut`: every leg clears its own
    /// slippage floor, and the minter is still 20% under-shared. Per-leg floors
    /// cannot see this, because the share count depends on the worst leg
    /// relative to the OTHERS, not on any leg's absolute output.
    function test_minSharesOut_catchesWhatPerLegFloorsCannot() public {
        _mintAtWeights(basket, alice, MINT_USDG, 0);

        adapter.setForcedOut(core, 480e18);

        uint256[] memory split = _splitAtWeights(basket, MINT_USDG);
        uint256[] memory minOut = new uint256[](2);
        minOut[0] = 450e18; // 480e18 delivered — clears
        minOut[1] = 350e18; // 400e18 delivered — clears
        _fundAndApprove(bob, basket, MINT_USDG);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Basket.InsufficientShares.selector, 800e18, 1000e18));
        basket.mint(MINT_USDG, split, minOut, 1000e18, bob);
    }

    function test_minSharesOut_passesWhenSatisfied() public {
        _mintAtWeights(basket, alice, MINT_USDG, 0);
        uint256 shares = _mintAtWeights(basket, bob, MINT_USDG, 1000e18);
        assertEq(shares, 1000e18);
    }

    // -----------------------------------------------------------------
    // Trusting measurement, not reports
    // -----------------------------------------------------------------

    /// @notice R4: the basket measures its own balance delta. An adapter that
    /// lies about `amountOut` cannot inflate the share count.
    function test_adapterReturnValueIsIgnored() public {
        adapter.setLieAboutOutput(true);

        uint256 shares = _mintAtWeights(basket, alice, MINT_USDG, 0);

        assertEq(shares, 1000e18 - basket.DEAD_SHARES(), "share count came from the measured delta");
        assertEq(basket.reserves(core), 600e18);
    }

    function test_legSlippageFloorIsEnforcedOnMeasuredDelta() public {
        adapter.setForcedOut(core, 500e18);

        uint256[] memory split = _splitAtWeights(basket, MINT_USDG);
        uint256[] memory minOut = new uint256[](2);
        minOut[0] = 590e18; // demands more than the 500e18 delivered
        _fundAndApprove(alice, basket, MINT_USDG);

        vm.prank(alice);
        vm.expectRevert("MockDexAdapter: slippage");
        basket.mint(MINT_USDG, split, minOut, 0, alice);
    }

    // -----------------------------------------------------------------
    // Donations are inert
    // -----------------------------------------------------------------

    /// @notice R6/R2: accounting runs on `reserves`, credited only from measured
    /// deltas during a mint. A donated leg token is not counted and not redeemable.
    function test_donatedLegTokenIsInert() public {
        _mintAtWeights(basket, alice, MINT_USDG, 0);

        (, uint256[] memory unitsBefore) = basket.unitsPerShare();
        uint256[] memory previewBefore = basket.previewRedeem(1000e18);

        MockERC20(core).mint(address(basket), 5_000e18); // a large donation

        (, uint256[] memory unitsAfter) = basket.unitsPerShare();
        uint256[] memory previewAfter = basket.previewRedeem(1000e18);

        assertEq(basket.reserves(core), 600e18, "reserve unchanged by donation");
        assertEq(unitsAfter[0], unitsBefore[0], "units per share unchanged");
        assertEq(previewAfter[0], previewBefore[0], "redemption unchanged");
        assertEq(basket.unaccounted(core), 5_000e18, "donation is visible but unclaimable");
    }

    /// @notice A donation cannot be used to move the min-ratio either, because
    /// the ratio reads `reserves`, not `balanceOf`.
    function test_donationDoesNotAffectSubsequentMintRatio() public {
        _mintAtWeights(basket, alice, MINT_USDG, 0);

        MockERC20(core).mint(address(basket), 5_000e18);

        uint256 shares = _mintAtWeights(basket, bob, MINT_USDG, 0);
        assertEq(shares, 1000e18, "share count is as if no donation happened");
    }

    /// @notice A rebasing base token sent to the vault sits there, inert.
    function test_donatedRebasingBaseTokenIsInert() public {
        _mintAtWeights(basket, alice, MINT_USDG, 0);

        MockRebasingToken base = new MockRebasingToken("Backed SPY", "SPYx");
        base.mint(address(basket), 1_000e18);

        assertEq(basket.reserves(address(base)), 0);
        assertEq(basket.unaccounted(address(base)), 1_000e18);

        // Redemption is unaffected: it pays only the legs.
        uint256[] memory amounts = basket.previewRedeem(1000e18);
        assertEq(amounts.length, 2);
        assertEq(amounts[0], 600e18);
        assertEq(amounts[1], 400e18);
    }

    // -----------------------------------------------------------------
    // First-depositor inflation attack
    // -----------------------------------------------------------------

    /// @notice THE required test. An attacker opens a basket with the minimum
    /// first mint, then donates 1000x the vault's holdings directly to it,
    /// trying to inflate `B_i` so that every later minter's
    /// `shares = S * min(d_i / B_i)` rounds to zero and the basket is bricked.
    ///
    /// A normal second mint must still receive sane shares, and `minSharesOut`
    /// must be satisfiable at a realistic value.
    function test_inflationAttack_donationAfterMinimumFirstMintDoesNotBrickTheBasket() public {
        address attacker = makeAddr("attacker");

        // 1. Attacker opens the basket at the smallest permitted basis.
        _mintAtWeights(basket, attacker, MIN_FIRST_MINT, 0);

        uint256 coreReserve = basket.reserves(core);
        uint256 tiltReserve = basket.reserves(tilt);
        uint256 supplyAfterOpen = basket.totalSupply();
        assertGt(coreReserve, 0);

        // 2. Attacker donates 1000x the vault's holdings, directly.
        MockERC20(core).mint(address(basket), coreReserve * 1000);
        MockERC20(tilt).mint(address(basket), tiltReserve * 1000);

        // The pivot: balances exploded, accounted reserves did not move at all.
        // `B_i` is not a balance, so there is nothing for the donation to inflate.
        assertEq(MockERC20(core).balanceOf(address(basket)), coreReserve * 1001, "balance inflated 1001x");
        assertEq(basket.reserves(core), coreReserve, "reserve untouched");
        assertEq(basket.reserves(tilt), tiltReserve, "reserve untouched");
        assertEq(basket.totalSupply(), supplyAfterOpen, "supply untouched");

        // 3. A normal victim mint still gets sane shares, and can demand them.
        //    $1,000 into a basket opened at $10 should mint ~100x the opening
        //    supply; require at least 90% of that up front via minSharesOut.
        uint256 expected = (supplyAfterOpen * MINT_USDG) / MIN_FIRST_MINT;
        uint256 demanded = (expected * 90) / 100;

        uint256 shares = _mintAtWeights(basket, bob, MINT_USDG, demanded);

        assertGe(shares, demanded, "minSharesOut was satisfiable");
        assertApproxEqRel(shares, expected, 0.01e18, "shares are proportional, not rounded to zero");
        assertGt(basket.balanceOf(bob), 0);

        // 4. And Bob's claim is real: he can redeem it for his share of the
        //    ACCOUNTED reserves. The donated tokens remain unclaimable by anyone.
        uint256[] memory payout = basket.previewRedeem(basket.balanceOf(bob));
        assertGt(payout[0], 0);
        assertGt(payout[1], 0);
        assertGt(basket.unaccounted(core), 0, "the donation is stranded, not distributed");
    }

    /// @notice The same attack with the donation made BEFORE the victim's mint
    /// lands, and with the attacker holding the smallest possible position.
    function testFuzz_inflationAttack_anyDonationSizeIsInert(uint256 donationMultiple) public {
        donationMultiple = bound(donationMultiple, 1, 1_000_000);

        address attacker = makeAddr("attacker");
        _mintAtWeights(basket, attacker, MIN_FIRST_MINT, 0);

        uint256 supplyAfterOpen = basket.totalSupply();
        MockERC20(core).mint(address(basket), basket.reserves(core) * donationMultiple);
        MockERC20(tilt).mint(address(basket), basket.reserves(tilt) * donationMultiple);

        uint256 expected = (supplyAfterOpen * MINT_USDG) / MIN_FIRST_MINT;
        uint256 shares = _mintAtWeights(basket, bob, MINT_USDG, 0);

        assertApproxEqRel(shares, expected, 0.01e18, "share count is independent of donations");
    }

    // -----------------------------------------------------------------
    // Redemption
    // -----------------------------------------------------------------

    function test_redeem_paysProRataInKind() public {
        _mintAtWeights(basket, alice, MINT_USDG, 0);

        vm.prank(alice);
        uint256[] memory amounts = basket.redeem(500e18, alice, _zeros(2));

        assertEq(amounts[0], 300e18);
        assertEq(amounts[1], 200e18);
        assertEq(MockERC20(core).balanceOf(alice), 300e18);
        assertEq(MockERC20(tilt).balanceOf(alice), 200e18);

        assertEq(basket.totalSupply(), 500e18);
        assertEq(basket.reserves(core), 300e18);
        assertEq(basket.reserves(tilt), 200e18);
    }

    function test_redeem_matchesPreview() public {
        _mintAtWeights(basket, alice, MINT_USDG, 0);

        uint256[] memory preview = basket.previewRedeem(371e18);

        vm.prank(alice);
        uint256[] memory amounts = basket.redeem(371e18, alice, _zeros(2));

        assertEq(amounts[0], preview[0]);
        assertEq(amounts[1], preview[1]);
    }

    /// @notice Redemption is deliberately not pausable: gating the exit would let
    /// the admin key trap user funds. Pausing stops new mints only.
    function test_redeem_worksWhilePaused() public {
        _mintAtWeights(basket, alice, MINT_USDG, 0);

        vm.prank(owner);
        arkiv.setPaused(true);

        vm.prank(alice);
        basket.redeem(500e18, alice, _zeros(2));
        assertEq(MockERC20(core).balanceOf(alice), 300e18);
    }

    /// @notice Nor is it sanctions-gated, for the same reason.
    function test_redeem_worksForSanctionedHolder() public {
        _mintAtWeights(basket, alice, MINT_USDG, 0);
        sanctions.set(alice, true);

        vm.prank(alice);
        basket.redeem(500e18, alice, _zeros(2));
        assertEq(MockERC20(core).balanceOf(alice), 300e18);
    }

    function test_redeem_enforcesMinAmountsOut() public {
        _mintAtWeights(basket, alice, MINT_USDG, 0);

        uint256[] memory minOut = new uint256[](2);
        minOut[0] = 301e18; // 300e18 is what a 500e18 redemption pays

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Basket.RedeemSlippage.selector, 0, core, 300e18, 301e18));
        basket.redeem(500e18, alice, minOut);
    }

    function test_redeem_revertsWithoutShares() public {
        _mintAtWeights(basket, alice, MINT_USDG, 0);

        vm.prank(bob);
        vm.expectRevert();
        basket.redeem(1e18, bob, _zeros(2));
    }

    // -----------------------------------------------------------------
    // R12 — the liveness bug the dead shares actually fixed
    // -----------------------------------------------------------------

    /// @notice The mechanism itself, isolated from the inflation scenario that
    /// prompted it: redeem the ENTIRE redeemable supply and every leg must still
    /// hold a non-zero reserve, because `mint` reverts `EmptyLeg` on a zero leg.
    ///
    /// Without dead shares this bricks the basket permanently, with no attacker
    /// and no donation involved — just the last holder leaving.
    function test_r12_fullRedemptionLeavesEveryLegNonZero() public {
        _mintAtWeights(basket, alice, MINT_USDG, 0);

        uint256 everything = basket.balanceOf(alice);
        vm.prank(alice);
        basket.redeem(everything, alice, _zeros(2));

        assertEq(basket.balanceOf(alice), 0, "the last holder is fully out");
        assertEq(basket.totalSupply(), basket.DEAD_SHARES(), "only dead shares remain");

        assertGt(basket.reserves(core), 0, "core leg did not floor to zero");
        assertGt(basket.reserves(tilt), 0, "tilt leg did not floor to zero");

        // The point of the invariant: the basket is still usable afterwards.
        uint256 shares = _mintAtWeights(basket, bob, MINT_USDG, 0);
        assertGt(shares, 0, "a fresh mint still succeeds");
    }

    /// @notice The same invariant across a wide range of supply and reserve
    /// magnitudes, since the failure is a rounding one and only shows up at
    /// particular ratios.
    function testFuzz_r12_noLegEverFloorsToZero(uint256 firstMintUsdg, uint256 coreRate, uint256 tiltRate) public {
        firstMintUsdg = bound(firstMintUsdg, MIN_FIRST_MINT, MINT_CAP);
        // Rates spanning twelve orders of magnitude: from a leg where $1 buys a
        // millionth of a token to one where it buys a million.
        coreRate = bound(coreRate, 1e24, 1e36);
        tiltRate = bound(tiltRate, 1e24, 1e36);

        adapter.setRate(core, coreRate);
        adapter.setRate(tilt, tiltRate);

        _mintAtWeights(basket, alice, firstMintUsdg, 0);

        uint256 everything = basket.balanceOf(alice);
        vm.prank(alice);
        basket.redeem(everything, alice, _zeros(2));

        assertGt(basket.reserves(core), 0, "core leg survived full redemption");
        assertGt(basket.reserves(tilt), 0, "tilt leg survived full redemption");

        uint256 shares = _mintAtWeights(basket, bob, MINT_USDG, 0);
        assertGt(shares, 0, "still mintable at any magnitude");
    }

    /// @notice Redeeming every redeemable share leaves the dead shares and a
    /// matching dust reserve behind, so no leg can ever reach zero and `mint`
    /// can never brick on `EmptyLeg`.
    ///
    /// The residue is `ceil(B_i * DEAD_SHARES / S)`, which is at least 1 wei
    /// whenever `B_i >= 1`. This is the property the dead shares are really for.
    function test_fullRedemptionLeavesTheBasketMintableForever() public {
        uint256 dead = basket.DEAD_SHARES();
        _mintAtWeights(basket, alice, MINT_USDG, 0);

        uint256 aliceShares = basket.balanceOf(alice);
        vm.prank(alice);
        basket.redeem(aliceShares, alice, _zeros(2));

        assertEq(basket.totalSupply(), dead, "only the dead shares remain");
        assertGt(basket.reserves(core), 0, "core leg is never zeroed");
        assertGt(basket.reserves(tilt), 0, "tilt leg is never zeroed");

        // And the basket still prices correctly off the surviving ratio.
        uint256 shares = _mintAtWeights(basket, bob, MINT_USDG, 0);
        assertGt(shares, 0);
        assertApproxEqRel(shares, 1000e18, 0.01e18, "basis carried through, not reset");
    }

    // -----------------------------------------------------------------
    // Mint guards
    // -----------------------------------------------------------------

    function test_mint_revertsWhenSplitDoesNotSumToInput() public {
        uint256[] memory split = new uint256[](2);
        split[0] = 600_000_000;
        split[1] = 300_000_000; // $100 short
        _fundAndApprove(alice, basket, MINT_USDG);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Basket.SplitMismatch.selector, 900_000_000, MINT_USDG));
        basket.mint(MINT_USDG, split, _zeros(2), 0, alice);
    }

    function test_mint_revertsOnZeroSplitLeg() public {
        uint256[] memory split = new uint256[](2);
        split[0] = MINT_USDG;
        split[1] = 0;
        _fundAndApprove(alice, basket, MINT_USDG);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Basket.ZeroSplit.selector, 1));
        basket.mint(MINT_USDG, split, _zeros(2), 0, alice);
    }

    function test_mint_revertsWhenPaused() public {
        vm.prank(owner);
        arkiv.setPaused(true);

        uint256[] memory split = _splitAtWeights(basket, MINT_USDG);
        _fundAndApprove(alice, basket, MINT_USDG);

        vm.prank(alice);
        vm.expectRevert(Arkiv.Paused.selector);
        basket.mint(MINT_USDG, split, _zeros(2), 0, alice);
    }

    function test_mint_revertsAboveCap() public {
        uint256 tooMuch = MINT_CAP + 1;
        uint256[] memory split = _splitAtWeights(basket, tooMuch);
        _fundAndApprove(alice, basket, tooMuch);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Arkiv.AboveMintCap.selector, tooMuch, MINT_CAP));
        basket.mint(tooMuch, split, _zeros(2), 0, alice);
    }

    function test_mint_atExactlyTheCapSucceeds() public {
        uint256 shares = _mintAtWeights(basket, alice, MINT_CAP, 0);
        assertEq(shares, 5000e18 - basket.DEAD_SHARES(), "$5,000 mints 5,000 shares, less the dead shares");
    }

    function test_mint_revertsOnArrayLengthMismatch() public {
        uint256[] memory split = new uint256[](3);
        _fundAndApprove(alice, basket, MINT_USDG);

        vm.prank(alice);
        vm.expectRevert(Basket.ArrayLengthMismatch.selector);
        basket.mint(MINT_USDG, split, _zeros(2), 0, alice);
    }

    function test_mint_leavesNoStandingAllowanceToTheAdapter() public {
        _mintAtWeights(basket, alice, MINT_USDG, 0);
        assertEq(usdg.allowance(address(basket), address(adapter)), 0);
    }

    // -----------------------------------------------------------------
    // Composition: thesis vs. reality
    // -----------------------------------------------------------------

    /// @notice `composition()` returns both numbers the UI shows side by side:
    /// the immutable declared thesis, and the units actually held.
    function test_composition_reportsThesisAndCurrentSeparately() public {
        _mintAtWeights(basket, alice, MINT_USDG, 0);

        (address[] memory tokens_, uint16[] memory thesis, uint256[] memory reserves_, uint256 supply) =
            basket.composition();

        assertEq(tokens_[0], core);
        assertEq(thesis[0], 6000, "declared at creation");
        assertEq(thesis[1], 4000);
        assertEq(reserves_[0], 600e18);
        assertEq(reserves_[1], 400e18);
        assertEq(supply, 1000e18);
    }

    /// @notice Buy and hold, stated as an invariant: what one share is backed by
    /// does not move when other people mint, no matter how favourable or
    /// unfavourable their execution was.
    ///
    /// This is why the drift a user sees is real. Unit backing per share is
    /// fixed, so any change in the VALUE split between legs is the legs' prices
    /// moving — the performance of the thesis — and never an artefact of someone
    /// else's mint. Converting units to a value weight needs a display price,
    /// which this contract deliberately does not have: it reports units, and the
    /// UI applies prices. There is no oracle in the settlement path.
    function test_buyAndHold_unitBackingPerShareSurvivesOtherMints() public {
        _mintAtWeights(basket, alice, MINT_USDG, 0);
        (, uint256[] memory unitsBefore) = basket.unitsPerShare();

        // Bob mints on badly skewed execution: core over-delivers by 50%.
        adapter.setForcedOut(core, 900e18);
        _mintAtWeights(basket, bob, MINT_USDG, 0);

        (, uint256[] memory unitsAfter) = basket.unitsPerShare();

        // The tilt leg binds at par, so Bob is credited 1,000 shares and his
        // surplus core is refunded rather than absorbed.
        assertEq(basket.balanceOf(bob), 1000e18);
        assertEq(MockERC20(core).balanceOf(bob), 300e18, "surplus refunded, not absorbed");

        assertApproxEqAbs(unitsAfter[0], unitsBefore[0], 1, "core units per share held");
        assertApproxEqAbs(unitsAfter[1], unitsBefore[1], 1, "tilt units per share held");
        assertGe(unitsAfter[0], unitsBefore[0], "rounding may only favour the basket");
        assertGe(unitsAfter[1], unitsBefore[1]);

        (, uint16[] memory thesisAfter,,) = basket.composition();
        assertEq(thesisAfter[0], 6000, "thesis weights never change");
        assertEq(thesisAfter[1], 4000);
    }

    function test_unitsPerShareIsZeroBeforeAnyMint() public view {
        (, uint256[] memory units) = basket.unitsPerShare();
        assertEq(units[0], 0);
        assertEq(units[1], 0);
    }

    // -----------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------

    /// @dev Pulls the `bindingToken` field out of the Minted event.
    function _bindingTokenFromLogs() internal returns (address) {
        Vm.Log[] memory logs = vm.getRecordedLogs();
        // usdgIn, fee, shares, bindingToken, received, used — minter and
        // receiver are indexed and so are not in `data`.
        bytes32 topic = keccak256("Minted(address,address,uint256,uint256,uint256,address,uint256[],uint256[])");

        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].topics[0] == topic) {
                (,,, address binding,,) =
                    abi.decode(logs[i].data, (uint256, uint256, uint256, address, uint256[], uint256[]));
                return binding;
            }
        }
        revert("Minted event not found");
    }
}
