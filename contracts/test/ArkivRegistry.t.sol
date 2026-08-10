// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ArkivFixture} from "./Fixtures.sol";
import {Arkiv} from "../src/Arkiv.sol";
import {Basket} from "../src/Basket.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MockERC20, MockRebasingToken} from "./mocks/MockERC20.sol";

contract ArkivRegistryTest is ArkivFixture {
    function setUp() public {
        setUpArkiv();
    }

    // -----------------------------------------------------------------
    // Allowlist
    // -----------------------------------------------------------------

    /// @notice R6: a rebasing base token must never enter the vault. This is
    /// enforced as a property of the token, not as a hand-maintained deny-list
    /// that an operator has to remember to update.
    function test_setAssetAllowed_rejectsRebasingToken() public {
        MockRebasingToken base = new MockRebasingToken("Backed SPY", "SPYx");

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Arkiv.RebasingToken.selector, address(base)));
        arkiv.setAssetAllowed(address(base), true, false);

        assertFalse(arkiv.isAllowed(address(base)));
    }

    function test_setAssetAllowed_acceptsNonRebasingWrapper() public {
        MockERC20 wrapper = new MockERC20("Backed SPY wrapper", "wSPYx", 18);

        vm.prank(owner);
        arkiv.setAssetAllowed(address(wrapper), true, true);

        assertTrue(arkiv.isAllowed(address(wrapper)));
    }

    /// @notice Removing an asset must not be blocked by the rebasing probe —
    /// otherwise a token that starts answering `multiplier()` after an upgrade
    /// could never be delisted.
    function test_setAssetAllowed_canAlwaysDisallow() public {
        MockRebasingToken base = new MockRebasingToken("Backed SPY", "SPYx");

        vm.prank(owner);
        arkiv.setAssetAllowed(address(base), false, false);

        assertFalse(arkiv.isAllowed(address(base)));
    }

    function test_setAssetAllowed_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        arkiv.setAssetAllowed(wrappers[0], true, true);
    }

    // -----------------------------------------------------------------
    // Admin
    // -----------------------------------------------------------------

    function test_setDexAdapter_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        arkiv.setDexAdapter(address(0xbeef));
    }

    function test_setDexAdapter_rejectsZero() public {
        vm.prank(owner);
        vm.expectRevert(Arkiv.ZeroAddress.selector);
        arkiv.setDexAdapter(address(0));
    }

    function test_setMintCap_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        arkiv.setMintCap(1);
    }

    function test_ownershipTransferIsTwoStep() public {
        vm.prank(owner);
        arkiv.transferOwnership(alice);
        assertEq(arkiv.owner(), owner, "owner unchanged until accepted");

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, bob));
        arkiv.acceptOwnership();

        vm.prank(alice);
        arkiv.acceptOwnership();
        assertEq(arkiv.owner(), alice);
        assertEq(arkiv.pendingOwner(), address(0));
    }

    // -----------------------------------------------------------------
    // Basket composition rules
    // -----------------------------------------------------------------

    function test_createBasket_happyPath() public {
        Basket basket = _createDefaultBasket();

        assertEq(basket.legCount(), 2);
        assertEq(basket.tokens()[0], wrappers[0]);
        assertEq(basket.thesisWeightsBps()[0], 6000);
        assertEq(basket.thesisURI(), "ipfs://thesis");
        assertEq(basket.decimals(), 18, "shares are 18 decimals regardless of holdings");
        assertTrue(arkiv.isBasket(address(basket)));
        assertEq(arkiv.basketCount(), 1);
    }

    /// @notice Legs per basket are the cost driver: L1 data fee scales with
    /// calldata and each leg is another swap.
    function test_createBasket_rejectsMoreThanEightLegs() public {
        address[] memory tokens = new address[](9);
        uint16[] memory weights = new uint16[](9);
        for (uint256 i; i < 8; ++i) {
            tokens[i] = wrappers[i];
        }
        // A ninth allowlisted token, above every existing address so the array
        // stays ascending.
        MockERC20 extra = new MockERC20("Extra", "wEXTRA", 18);
        vm.prank(owner);
        arkiv.setAssetAllowed(address(extra), true, true);
        tokens[8] = address(extra);
        _forceAscending(tokens);

        vm.expectRevert(abi.encodeWithSelector(Arkiv.BadLegCount.selector, 9));
        arkiv.createBasket("X", "X", tokens, weights, "");
    }

    function test_createBasket_rejectsSingleLeg() public {
        address[] memory tokens = new address[](1);
        tokens[0] = wrappers[0];
        uint16[] memory weights = new uint16[](1);
        weights[0] = 10_000;

        vm.expectRevert(abi.encodeWithSelector(Arkiv.BadLegCount.selector, 1));
        arkiv.createBasket("X", "X", tokens, weights, "");
    }

    function test_createBasket_rejectsWeightsNotSummingToBps() public {
        (address[] memory tokens, uint16[] memory weights) = _twoLeg(6000, 3999);

        vm.expectRevert(abi.encodeWithSelector(Arkiv.WeightsMustSumToBps.selector, 9999));
        arkiv.createBasket("X", "X", tokens, weights, "");
    }

    /// @notice Below 500 bps a leg costs more in gas and slippage than it
    /// contributes in expression.
    function test_createBasket_rejectsLegBelowFiveHundredBps() public {
        address[] memory tokens = new address[](3);
        tokens[0] = wrappers[0];
        tokens[1] = wrappers[1];
        tokens[2] = wrappers[4];

        uint16[] memory weights = new uint16[](3);
        weights[0] = 5000;
        weights[1] = 4700;
        weights[2] = 300; // below the floor

        vm.expectRevert(abi.encodeWithSelector(Arkiv.LegBelowMinimum.selector, wrappers[4], 300));
        arkiv.createBasket("X", "X", tokens, weights, "");
    }

    function test_createBasket_rejectsDuplicateLeg() public {
        address[] memory tokens = new address[](2);
        tokens[0] = wrappers[0];
        tokens[1] = wrappers[0];

        uint16[] memory weights = new uint16[](2);
        weights[0] = 5000;
        weights[1] = 5000;

        vm.expectRevert(abi.encodeWithSelector(Arkiv.TokensNotAscending.selector, wrappers[0], wrappers[0]));
        arkiv.createBasket("X", "X", tokens, weights, "");
    }

    function test_createBasket_rejectsUnsortedLegs() public {
        address[] memory tokens = new address[](2);
        tokens[0] = wrappers[4];
        tokens[1] = wrappers[0];

        uint16[] memory weights = new uint16[](2);
        weights[0] = 5000;
        weights[1] = 5000;

        vm.expectRevert(abi.encodeWithSelector(Arkiv.TokensNotAscending.selector, wrappers[4], wrappers[0]));
        arkiv.createBasket("X", "X", tokens, weights, "");
    }

    /// @notice R2: a caller-supplied address that is not on the allowlist — a
    /// decoy "xStocks" ERC-20, for instance — can never become a leg.
    function test_createBasket_rejectsNonAllowlistedToken() public {
        MockERC20 decoy = new MockERC20("xStocks", "xStocks", 18);

        address[] memory tokens = new address[](2);
        uint16[] memory weights = new uint16[](2);
        weights[0] = 5000;
        weights[1] = 5000;

        if (address(decoy) > wrappers[0]) {
            tokens[0] = wrappers[0];
            tokens[1] = address(decoy);
        } else {
            tokens[0] = address(decoy);
            tokens[1] = wrappers[0];
        }

        vm.expectRevert(abi.encodeWithSelector(Arkiv.NotAllowed.selector, address(decoy)));
        arkiv.createBasket("X", "X", tokens, weights, "");
    }

    function test_createBasket_rejectsCoreBelowFiveThousandBps() public {
        // One core leg at 4000, two tilt legs at 3000 each.
        address[] memory tokens = new address[](3);
        tokens[0] = wrappers[0]; // core
        tokens[1] = wrappers[4]; // tilt
        tokens[2] = wrappers[5]; // tilt

        uint16[] memory weights = new uint16[](3);
        weights[0] = 4000;
        weights[1] = 3000;
        weights[2] = 3000;

        vm.expectRevert(abi.encodeWithSelector(Arkiv.CoreBelowMinimum.selector, 4000));
        arkiv.createBasket("X", "X", tokens, weights, "");
    }

    function test_createBasket_acceptsExactlyFiveThousandCore() public {
        (address[] memory tokens, uint16[] memory weights) = _twoLeg(5000, 5000);
        address basket = arkiv.createBasket("X", "X", tokens, weights, "");
        assertTrue(arkiv.isBasket(basket));
    }

    function test_createBasket_rejectsArrayLengthMismatch() public {
        address[] memory tokens = new address[](2);
        tokens[0] = wrappers[0];
        tokens[1] = wrappers[4];
        uint16[] memory weights = new uint16[](3);

        vm.expectRevert(Arkiv.ArrayLengthMismatch.selector);
        arkiv.createBasket("X", "X", tokens, weights, "");
    }

    /// @notice Creation is permissionless: every rule that matters is on-chain.
    function test_createBasket_isPermissionless() public {
        (address[] memory tokens, uint16[] memory weights) = _twoLeg(6000, 4000);

        vm.prank(alice);
        address basket = arkiv.createBasket("Alice's thesis", "ALICE", tokens, weights, "ipfs://a");
        assertTrue(arkiv.isBasket(basket));
    }

    /// @notice A basket can only come from the factory, so nothing can bypass
    /// the composition rules by deploying its own.
    function test_basketConstructor_rejectsNonArkivDeployer() public {
        address[] memory tokens = new address[](2);
        uint16[] memory weights = new uint16[](2);

        vm.expectRevert(Basket.OnlyArkiv.selector);
        new Basket(address(arkiv), address(usdg), "X", "X", tokens, weights, "");
    }

    // -----------------------------------------------------------------
    // checkMint
    // -----------------------------------------------------------------

    function test_checkMint_revertsWhenPaused() public {
        vm.prank(owner);
        arkiv.setPaused(true);

        vm.expectRevert(Arkiv.Paused.selector);
        arkiv.checkMint(alice, alice, 1e6);
    }

    function test_checkMint_enforcesMintCap() public {
        assertEq(arkiv.mintCap(), 5_000_000_000, "cap is $5,000 at SIX decimals");

        arkiv.checkMint(alice, alice, 5_000_000_000); // exactly at the cap is fine

        vm.expectRevert(abi.encodeWithSelector(Arkiv.AboveMintCap.selector, 5_000_000_001, 5_000_000_000));
        arkiv.checkMint(alice, alice, 5_000_000_001);
    }

    function test_checkMint_rejectsZero() public {
        vm.expectRevert(Arkiv.ZeroAmount.selector);
        arkiv.checkMint(alice, alice, 0);
    }

    /// @notice R3: the wrappers expose no sanctions getter, so Arkiv reads the
    /// deny-list itself. Both payer and share receiver are screened.
    function test_checkMint_screensMinterAndReceiver() public {
        sanctions.set(alice, true);
        vm.expectRevert(abi.encodeWithSelector(Arkiv.Sanctioned.selector, alice));
        arkiv.checkMint(alice, bob, 1e6);

        sanctions.set(alice, false);
        sanctions.set(bob, true);
        vm.expectRevert(abi.encodeWithSelector(Arkiv.Sanctioned.selector, bob));
        arkiv.checkMint(alice, bob, 1e6);
    }

    // -----------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------

    function _twoLeg(uint16 coreBps, uint16 tiltBps)
        internal
        view
        returns (address[] memory tokens, uint16[] memory weights)
    {
        tokens = new address[](2);
        tokens[0] = wrappers[0];
        tokens[1] = wrappers[4];

        weights = new uint16[](2);
        weights[0] = coreBps;
        weights[1] = tiltBps;
    }

    function _forceAscending(address[] memory a) private pure {
        for (uint256 i = 1; i < a.length; ++i) {
            address key = a[i];
            uint256 j = i;
            while (j > 0 && a[j - 1] > key) {
                a[j] = a[j - 1];
                --j;
            }
            a[j] = key;
        }
    }
}
