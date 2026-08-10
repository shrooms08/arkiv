// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Arkiv} from "../src/Arkiv.sol";
import {Basket} from "../src/Basket.sol";
import {MockERC20, MockRebasingToken} from "./mocks/MockERC20.sol";
import {MockSanctionsList} from "./mocks/MockSanctionsList.sol";
import {MockDexAdapter} from "./mocks/MockDexAdapter.sol";

/// @notice Shared setup: USDG at 6 decimals, a deterministic adapter, and eight
/// allowlisted 18-decimal wrappers sorted ascending (Arkiv requires strictly
/// ascending legs, which is how it rejects duplicates).
///
/// The first four wrappers are marked core, mirroring the real universe's four
/// core assets (GLDx, QQQx, SPYx, IWMx).
abstract contract ArkivFixture is Test {
    MockERC20 internal usdg;
    MockSanctionsList internal sanctions;
    MockDexAdapter internal adapter;
    Arkiv internal arkiv;

    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    /// @notice Sorted ascending. Indices 0-3 are core, 4-7 are tilt.
    address[] internal wrappers;

    uint256 internal constant CORE_COUNT = 4;
    uint256 internal constant MINT_CAP = 5_000_000_000; // $5,000 at 6 decimals
    uint256 internal constant MIN_FIRST_MINT = 10_000_000; // $10 at 6 decimals

    /// @notice Adapter rate meaning $1 of USDG buys one whole 18-dp wrapper.
    uint256 internal constant PAR_RATE = 1e30;

    function setUpArkiv() internal {
        usdg = new MockERC20("Global Dollar", "USDG", 6);
        sanctions = new MockSanctionsList();
        adapter = new MockDexAdapter();

        arkiv = new Arkiv(address(usdg), address(sanctions), address(adapter), MINT_CAP, MIN_FIRST_MINT, owner);

        address[] memory deployed = new address[](8);
        for (uint256 i; i < 8; ++i) {
            deployed[i] = address(new MockERC20("Wrapper", "wXXXx", 18));
        }
        _sort(deployed);

        for (uint256 i; i < 8; ++i) {
            wrappers.push(deployed[i]);
            adapter.setRate(deployed[i], PAR_RATE);
            vm.prank(owner);
            arkiv.setAssetAllowed(deployed[i], true, i < CORE_COUNT);
        }
    }

    /// @notice A two-leg basket: one core at 60%, one tilt at 40%.
    function _createDefaultBasket() internal returns (Basket) {
        address[] memory tokens = new address[](2);
        tokens[0] = wrappers[0];
        tokens[1] = wrappers[4];

        uint16[] memory weights = new uint16[](2);
        weights[0] = 6000;
        weights[1] = 4000;

        return Basket(arkiv.createBasket("Thesis", "ARK1", tokens, weights, "ipfs://thesis"));
    }

    function _fundAndApprove(address who, Basket basket, uint256 amount) internal {
        usdg.mint(who, amount);
        vm.prank(who);
        usdg.approve(address(basket), amount);
    }

    /// @notice The USDG split proportional to the thesis weights. In production
    /// this comes from a quote sized to current composition; here it is the
    /// declared weights, which is the same thing on the first mint.
    function _splitAtWeights(Basket basket, uint256 usdgIn) internal view returns (uint256[] memory split) {
        uint16[] memory weights = basket.thesisWeightsBps();
        uint256 n = weights.length;

        split = new uint256[](n);
        uint256 assigned;
        for (uint256 i; i < n - 1; ++i) {
            split[i] = (usdgIn * weights[i]) / 10_000;
            assigned += split[i];
        }
        split[n - 1] = usdgIn - assigned; // remainder to the last leg
    }

    /// @notice Mint with the USDG split proportional to the thesis weights.
    function _mintAtWeights(Basket basket, address who, uint256 usdgIn, uint256 minSharesOut)
        internal
        returns (uint256 shares)
    {
        uint256[] memory split = _splitAtWeights(basket, usdgIn);
        uint256[] memory minOut = new uint256[](split.length);

        _fundAndApprove(who, basket, usdgIn);
        vm.prank(who);
        shares = basket.mint(usdgIn, split, minOut, minSharesOut, who);
    }

    /// @notice A zeroed floor array of length `n`.
    /// @dev Deliberately `pure` and length-taking rather than reading
    /// `basket.legCount()`. A helper that makes an external call cannot be used
    /// in an argument position after `vm.prank` or `vm.expectRevert`, because it
    /// consumes the cheatcode meant for the call under test.
    function _zeros(uint256 n) internal pure returns (uint256[] memory) {
        return new uint256[](n);
    }

    function _sort(address[] memory a) private pure {
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
