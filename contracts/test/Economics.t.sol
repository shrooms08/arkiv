// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {Arkiv} from "../src/Arkiv.sol";
import {Basket} from "../src/Basket.sol";
import {ArkivFixture} from "./Fixtures.sol";

/// @notice The mint fee, the curator split, and the rule that makes the split
/// mean something: accrual stops when the thesis is proved wrong.
///
/// Every assertion about money measures a `balanceOf` delta rather than trusting
/// a return value or a hardcoded amount, so a change in how the fee is routed
/// cannot pass by rewriting an expected constant.
contract EconomicsTest is ArkivFixture {
    Basket internal basket;

    address internal curator = makeAddr("curator");
    address internal attestor = makeAddr("attestor");
    address internal treasury = makeAddr("treasury");

    bytes32 internal constant EVIDENCE = keccak256("arkiv:de82aadb08bef443/observable-breached");

    function setUp() public {
        setUpArkiv();

        vm.prank(owner);
        arkiv.setAttestor(attestor);

        // The curator is the creator, so the basket must be created by them.
        vm.prank(curator);
        basket = _createDefaultBasket();
    }

    /// @dev Index of `basket` in the archive. One basket, so zero.
    function _basketId() internal pure returns (uint256) {
        return 0;
    }

    // -----------------------------------------------------------------
    // 1. Mint fee
    // -----------------------------------------------------------------

    function test_defaultFeeIsThirtyBps() public {
        // The fixture zeroes it; the registry's own default is what ships.
        Arkiv fresh = new Arkiv(address(usdg), address(sanctions), address(adapter), MINT_CAP, MIN_FIRST_MINT, owner);
        assertEq(fresh.feeBps(), 30, "default mint fee");
        assertEq(fresh.curatorBps(), 5000, "default curator share");
        assertEq(fresh.MAX_FEE_BPS(), 100, "hard cap");
    }

    /// @notice Fee is charged correctly across the whole allowed range.
    function test_feeChargedAtSeveralRates() public {
        uint256[4] memory rates = [uint256(0), 1, 30, 100];

        for (uint256 r; r < rates.length; ++r) {
            // A fresh basket each time so every case is a first mint and the
            // arithmetic is not entangled with a previous case's reserves.
            vm.prank(curator);
            Basket b = _createDefaultBasket();
            _setFeeBps(rates[r]);

            uint256 usdgIn = 1_000_000_000; // $1,000
            uint256 expectedFee = (usdgIn * rates[r]) / 10_000;

            uint256 registryBefore = usdg.balanceOf(address(arkiv));
            _mintAtWeights(b, alice, usdgIn, 0);
            uint256 booked = usdg.balanceOf(address(arkiv)) - registryBefore;

            assertEq(booked, expectedFee, "registry received exactly the fee");
            assertEq(
                arkiv.curatorEarnings(curator) + arkiv.protocolEarnings(),
                _totalBookedSoFar(),
                "every booked fee is claimable by someone"
            );

            // What reached the legs is the net, and the basis follows it.
            assertEq(b.totalSupply(), (usdgIn - expectedFee) * b.FIRST_MINT_SCALE(), "basis on the net");
        }
    }

    /// @dev Running total of USDG held by the registry, which is exactly the sum
    /// of everything booked and not yet claimed.
    function _totalBookedSoFar() internal view returns (uint256) {
        return usdg.balanceOf(address(arkiv));
    }

    function test_zeroFeeTakesNothing() public {
        _setFeeBps(0);

        uint256 before = usdg.balanceOf(address(arkiv));
        _mintAtWeights(basket, alice, 1_000_000_000, 0);

        assertEq(usdg.balanceOf(address(arkiv)) - before, 0, "no fee taken");
        assertEq(arkiv.curatorEarnings(curator), 0);
        assertEq(arkiv.protocolEarnings(), 0);
    }

    function test_feeCannotExceedCap() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Arkiv.FeeAboveCap.selector, 101, 100));
        arkiv.setFeeBps(101);

        // The boundary itself is allowed.
        _setFeeBps(100);
        assertEq(arkiv.feeBps(), 100);
    }

    function test_onlyOwnerCanSetFee() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        arkiv.setFeeBps(10);
    }

    function test_quoteMintFeeMatchesWhatIsCharged() public {
        _setFeeBps(30);

        uint256 usdgIn = 1_234_567_890;
        (uint256 fee, uint256 net) = arkiv.quoteMintFee(usdgIn);
        assertEq(fee + net, usdgIn, "quote accounts for every unit");

        uint256 before = usdg.balanceOf(address(arkiv));
        _mintAtWeights(basket, alice, usdgIn, 0);

        assertEq(usdg.balanceOf(address(arkiv)) - before, fee, "charged what was quoted");
    }

    /// @notice The split must cover the post-fee amount, and a split sized to
    /// the gross is rejected rather than silently under-spending.
    function test_splitMustCoverNetNotGross() public {
        _setFeeBps(30);

        uint256 usdgIn = 1_000_000_000;
        uint256[] memory grossSplit = new uint256[](2);
        grossSplit[0] = (usdgIn * 6000) / 10_000;
        grossSplit[1] = usdgIn - grossSplit[0];

        _fundAndApprove(alice, basket, usdgIn);

        (, uint256 net) = arkiv.quoteMintFee(usdgIn);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Basket.SplitMismatch.selector, usdgIn, net));
        basket.mint(usdgIn, grossSplit, _zeros(2), 0, alice);
    }

    // -----------------------------------------------------------------
    // 2. Curator split
    // -----------------------------------------------------------------

    function test_curatorIsTheCreator() public view {
        assertEq(arkiv.creatorOf(address(basket)), curator, "creator recorded on chain");
    }

    function test_curatorSplitAtSeveralRates() public {
        uint256[4] memory shares = [uint256(0), 2500, 5000, 10_000];
        _setFeeBps(100);

        for (uint256 i; i < shares.length; ++i) {
            vm.prank(curator);
            Basket b = _createDefaultBasket();
            _setCuratorBps(shares[i]);

            uint256 usdgIn = 1_000_000_000;
            uint256 fee = (usdgIn * 100) / 10_000;
            uint256 expectedCurator = (fee * shares[i]) / 10_000;

            uint256 curatorBefore = arkiv.curatorEarnings(curator);
            uint256 protocolBefore = arkiv.protocolEarnings();

            _mintAtWeights(b, alice, usdgIn, 0);

            assertEq(arkiv.curatorEarnings(curator) - curatorBefore, expectedCurator, "curator share");
            assertEq(arkiv.protocolEarnings() - protocolBefore, fee - expectedCurator, "protocol takes the rest");
        }
    }

    function test_accrualDoesNotTransferOnMint() public {
        _setFeeBps(30);

        uint256 curatorWalletBefore = usdg.balanceOf(curator);
        _mintAtWeights(basket, alice, 1_000_000_000, 0);

        assertEq(usdg.balanceOf(curator), curatorWalletBefore, "nothing pushed to the curator");
        assertGt(arkiv.curatorEarnings(curator), 0, "accrued instead");
    }

    function test_claimTransfersExactAccrualAndZeroesIt() public {
        _setFeeBps(30);
        _mintAtWeights(basket, alice, 1_000_000_000, 0);
        _mintAtWeights(basket, bob, 500_000_000, 0);

        uint256 accrued = arkiv.curatorEarnings(curator);
        assertGt(accrued, 0);

        uint256 walletBefore = usdg.balanceOf(curator);
        uint256 registryBefore = usdg.balanceOf(address(arkiv));

        vm.prank(curator);
        uint256 claimed = arkiv.claimCuratorFees();

        assertEq(claimed, accrued, "claim returns what was accrued");
        assertEq(usdg.balanceOf(curator) - walletBefore, accrued, "measured wallet delta");
        assertEq(registryBefore - usdg.balanceOf(address(arkiv)), accrued, "measured registry delta");
        assertEq(arkiv.curatorEarnings(curator), 0, "balance zeroed");
    }

    function test_claimTwiceReverts() public {
        _setFeeBps(30);
        _mintAtWeights(basket, alice, 1_000_000_000, 0);

        vm.prank(curator);
        arkiv.claimCuratorFees();

        vm.prank(curator);
        vm.expectRevert(Arkiv.NothingToClaim.selector);
        arkiv.claimCuratorFees();
    }

    function test_protocolFeesClaimableByOwnerOnly() public {
        _setFeeBps(30);
        _mintAtWeights(basket, alice, 1_000_000_000, 0);

        uint256 accrued = arkiv.protocolEarnings();
        assertGt(accrued, 0);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        arkiv.claimProtocolFees(treasury);

        uint256 before = usdg.balanceOf(treasury);
        vm.prank(owner);
        arkiv.claimProtocolFees(treasury);

        assertEq(usdg.balanceOf(treasury) - before, accrued, "measured treasury delta");
        assertEq(arkiv.protocolEarnings(), 0);
    }

    function test_recordFeeRejectsNonBasketCallers() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Arkiv.NotABasket.selector, alice));
        arkiv.recordFee(1_000_000);
    }

    // -----------------------------------------------------------------
    // 3. Breach-conditional accrual
    // -----------------------------------------------------------------

    function test_onlyAttestorCanAttestBreach() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Arkiv.OnlyAttestor.selector, alice));
        arkiv.attestBreach(_basketId(), EVIDENCE);

        // Not even the owner, once the role has been delegated.
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Arkiv.OnlyAttestor.selector, owner));
        arkiv.attestBreach(_basketId(), EVIDENCE);

        vm.prank(attestor);
        arkiv.attestBreach(_basketId(), EVIDENCE);
        assertTrue(arkiv.breached(address(basket)));
    }

    function test_breachIsNotReversible() public {
        vm.prank(attestor);
        arkiv.attestBreach(_basketId(), EVIDENCE);

        // There is no un-breach entrypoint at all; the closest thing is a second
        // attestation, which is rejected so the timestamp cannot be moved.
        vm.prank(attestor);
        vm.expectRevert(abi.encodeWithSelector(Arkiv.AlreadyBreached.selector, address(basket)));
        arkiv.attestBreach(_basketId(), EVIDENCE);

        assertTrue(arkiv.breached(address(basket)), "still breached");
    }

    function test_breachRecordsTimestampAndEvidence() public {
        vm.warp(1_800_000_000);

        vm.expectEmit(true, true, false, true, address(arkiv));
        emit Arkiv.BreachAttested(address(basket), _basketId(), EVIDENCE, uint64(1_800_000_000), attestor);

        vm.prank(attestor);
        arkiv.attestBreach(_basketId(), EVIDENCE);

        assertEq(arkiv.breachedAt(address(basket)), 1_800_000_000);
    }

    function test_unknownBasketIdReverts() public {
        vm.prank(attestor);
        vm.expectRevert(abi.encodeWithSelector(Arkiv.UnknownBasket.selector, 99));
        arkiv.attestBreach(99, EVIDENCE);
    }

    /// @notice The mechanism. Before breach the curator accrues; after, nothing.
    function test_accrualStopsOnBreachAndFullFeeGoesToProtocol() public {
        _setFeeBps(100);
        _setCuratorBps(5000);

        uint256 usdgIn = 1_000_000_000;
        uint256 fee = (usdgIn * 100) / 10_000;

        _mintAtWeights(basket, alice, usdgIn, 0);
        uint256 accruedBefore = arkiv.curatorEarnings(curator);
        assertEq(accruedBefore, fee / 2, "half the fee while the thesis stands");

        vm.prank(attestor);
        arkiv.attestBreach(_basketId(), EVIDENCE);

        uint256 protocolBefore = arkiv.protocolEarnings();
        _mintAtWeights(basket, bob, usdgIn, 0);

        assertEq(arkiv.curatorEarnings(curator), accruedBefore, "stream stopped dead");
        assertEq(arkiv.protocolEarnings() - protocolBefore, fee, "the whole fee now routes to protocol");
    }

    /// @notice Breach stops the stream; it does not claw back what was earned
    /// while the thesis still stood.
    function test_alreadyAccruedSurvivesBreachAndStaysClaimable() public {
        _setFeeBps(100);
        _mintAtWeights(basket, alice, 1_000_000_000, 0);

        uint256 accrued = arkiv.curatorEarnings(curator);
        assertGt(accrued, 0);

        vm.prank(attestor);
        arkiv.attestBreach(_basketId(), EVIDENCE);

        assertEq(arkiv.curatorEarnings(curator), accrued, "not clawed back");

        uint256 before = usdg.balanceOf(curator);
        vm.prank(curator);
        arkiv.claimCuratorFees();
        assertEq(usdg.balanceOf(curator) - before, accrued, "still claimable after breach");
    }

    /// @notice Breach is per basket, not per curator.
    function test_breachOfOneBasketDoesNotStopAnother() public {
        _setFeeBps(100);

        vm.prank(curator);
        Basket second = _createDefaultBasket();

        vm.prank(attestor);
        arkiv.attestBreach(0, EVIDENCE); // the first basket only

        uint256 before = arkiv.curatorEarnings(curator);
        _mintAtWeights(second, alice, 1_000_000_000, 0);

        assertGt(arkiv.curatorEarnings(curator) - before, 0, "the standing thesis still earns");
    }

    // -----------------------------------------------------------------
    // R10: none of the above may reach redemption
    // -----------------------------------------------------------------

    /// @notice Redemption is unaffected by fee, curator split, breach or pause.
    ///
    /// @dev The strongest statement available: with the fee at its cap, the
    /// basket breached and minting paused, a holder still exits in full and the
    /// payout is byte-identical to the fee-free preview.
    function test_redemptionUnaffectedByFeeBreachOrPause() public {
        _setFeeBps(100);
        uint256 shares = _mintAtWeights(basket, alice, 1_000_000_000, 0);

        vm.prank(attestor);
        arkiv.attestBreach(_basketId(), EVIDENCE);
        vm.prank(owner);
        arkiv.setPaused(true);

        uint256[] memory preview = basket.previewRedeem(shares);

        address[] memory legs = basket.tokens();
        uint256[] memory before = new uint256[](legs.length);
        for (uint256 i; i < legs.length; ++i) {
            before[i] = IERC20(legs[i]).balanceOf(alice);
        }

        vm.prank(alice);
        uint256[] memory amounts = basket.redeem(shares, alice, _zeros(2));

        for (uint256 i; i < legs.length; ++i) {
            assertEq(amounts[i], preview[i], "payout matches preview");
            assertEq(IERC20(legs[i]).balanceOf(alice) - before[i], amounts[i], "measured delta, in kind");
            assertGt(amounts[i], 0);
        }
        assertEq(basket.balanceOf(alice), 0, "exited in full");
    }

    /// @notice No USDG leaves on the redemption path at any fee setting.
    function test_redemptionTakesNoUsdgFee() public {
        _setFeeBps(100);
        uint256 shares = _mintAtWeights(basket, alice, 1_000_000_000, 0);

        uint256 registryBefore = usdg.balanceOf(address(arkiv));
        uint256 aliceBefore = usdg.balanceOf(alice);

        vm.prank(alice);
        basket.redeem(shares, alice, _zeros(2));

        assertEq(usdg.balanceOf(address(arkiv)), registryBefore, "registry took nothing on the way out");
        assertEq(usdg.balanceOf(alice), aliceBefore, "redemption is in kind, no USDG moves");
    }

    /// @notice A sanctioned holder can still exit. Fee work must not have
    /// introduced a gate on the way out.
    function test_sanctionedHolderStillRedeemsUnderFeeAndBreach() public {
        _setFeeBps(100);
        uint256 shares = _mintAtWeights(basket, alice, 1_000_000_000, 0);

        vm.prank(attestor);
        arkiv.attestBreach(_basketId(), EVIDENCE);
        sanctions.set(alice, true);

        vm.prank(alice);
        uint256[] memory amounts = basket.redeem(shares, alice, _zeros(2));

        assertGt(amounts[0], 0, "exit is never gated");
        assertEq(basket.balanceOf(alice), 0);
    }

    // -----------------------------------------------------------------
    // Share maths is untouched by the fee
    // -----------------------------------------------------------------

    /// @notice The fee changes how many dollars reach the legs and nothing else.
    ///
    /// @dev Two identical baskets, one at 0 bps and one at 100 bps. The second
    /// receives exactly 99% of the first's units and is issued exactly 99% of
    /// its shares — so `shares = S * min_i(d_i / B_i)` still resolves against
    /// measured deltas, with the fee entering only through `d_i`.
    function test_feeScalesUnitsAndSharesTogetherLeavingRatiosIntact() public {
        uint256 usdgIn = 1_000_000_000;

        _setFeeBps(0);
        vm.prank(curator);
        Basket free = _createDefaultBasket();
        uint256 freeShares = _mintAtWeights(free, alice, usdgIn, 0);

        _setFeeBps(100);
        vm.prank(curator);
        Basket taxed = _createDefaultBasket();
        uint256 taxedShares = _mintAtWeights(taxed, bob, usdgIn, 0);

        assertEq(taxedShares, (freeShares + free.DEAD_SHARES()) * 9900 / 10_000 - taxed.DEAD_SHARES(), "99% of shares");

        address[] memory legs = free.tokens();
        for (uint256 i; i < legs.length; ++i) {
            assertEq(taxed.reserves(legs[i]), (free.reserves(legs[i]) * 9900) / 10_000, "99% of every leg");
        }
    }

    /// @notice A second mint under a fee still binds on the worst leg.
    function test_secondMintUnderFeeStillBindsOnWorstLeg() public {
        _setFeeBps(30);
        _mintAtWeights(basket, alice, 1_000_000_000, 0);

        address[] memory legs = basket.tokens();
        // Halve the rate on leg 0 so it under-delivers and must bind.
        adapter.setRate(legs[0], PAR_RATE / 2);

        uint256 supplyBefore = basket.totalSupply();
        uint256 reserveBefore = basket.reserves(legs[0]);

        uint256 shares = _mintAtWeights(basket, bob, 500_000_000, 0);

        uint256 delta = basket.reserves(legs[0]) - reserveBefore;
        assertEq(shares, (supplyBefore * delta) / reserveBefore, "worst leg set the share count");
    }

    // -----------------------------------------------------------------
    // 4. Curator track record
    // -----------------------------------------------------------------

    function test_curatorRecordCountsClaimsNotReturns() public {
        vm.prank(curator);
        _createDefaultBasket();
        vm.prank(curator);
        _createDefaultBasket();

        (uint256 authored, uint256 breachedCount, uint256 standing) = arkiv.curatorRecord(curator);
        assertEq(authored, 3, "three theses filed");
        assertEq(breachedCount, 0);
        assertEq(standing, 3);

        vm.prank(attestor);
        arkiv.attestBreach(1, EVIDENCE);

        (authored, breachedCount, standing) = arkiv.curatorRecord(curator);
        assertEq(authored, 3, "the archive never shrinks");
        assertEq(breachedCount, 1);
        assertEq(standing, 2, "two claims still stand");
    }

    function test_basketsByCuratorListsInCreationOrder() public {
        vm.prank(curator);
        Basket second = _createDefaultBasket();

        address[] memory mine = arkiv.basketsByCurator(curator);
        assertEq(mine.length, 2);
        assertEq(mine[0], address(basket));
        assertEq(mine[1], address(second));

        assertEq(arkiv.basketsByCurator(alice).length, 0, "alice has authored nothing");
    }

    function test_recordIsPerCuratorNotGlobal() public {
        vm.prank(alice);
        Basket hers = _createDefaultBasket();

        vm.prank(attestor);
        arkiv.attestBreach(1, EVIDENCE); // alice's basket

        (, uint256 curatorBreached,) = arkiv.curatorRecord(curator);
        (uint256 aliceAuthored, uint256 aliceBreached,) = arkiv.curatorRecord(alice);

        assertEq(curatorBreached, 0, "not charged to the wrong author");
        assertEq(aliceAuthored, 1);
        assertEq(aliceBreached, 1);
        assertEq(arkiv.creatorOf(address(hers)), alice);
    }
}
