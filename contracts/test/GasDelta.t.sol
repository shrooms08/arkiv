// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Basket} from "../src/Basket.sol";
import {ArkivFixture} from "./Fixtures.sol";

/// @notice Gas cost of the mint fee, isolated.
///
/// @dev One measurement per test function. Foundry re-runs `setUp` for each, so
/// the fee-free and fee-charging cases meet identical cold storage. Measuring
/// both inside one function does not work: the second mint reuses slots the
/// first one warmed, and the fee case came out 17k CHEAPER than the baseline —
/// an artefact of ordering, not a saving.
contract GasDeltaTest is ArkivFixture {
    function setUp() public {
        setUpArkiv();
    }

    function _firstMintGas() internal returns (uint256 used) {
        Basket b = _createDefaultBasket();

        uint256 usdgIn = 1_000_000_000;
        uint256[] memory split = _splitAtWeights(b, usdgIn);
        uint256[] memory minOut = new uint256[](split.length);
        _fundAndApprove(alice, b, usdgIn);

        vm.prank(alice);
        uint256 g0 = gasleft();
        b.mint(usdgIn, split, minOut, 0, alice);
        used = g0 - gasleft();
    }

    function _secondMintGas() internal returns (uint256 used) {
        Basket b = _createDefaultBasket();
        _mintAtWeights(b, bob, 1_000_000_000, 0);

        uint256 usdgIn = 1_000_000_000;
        uint256[] memory split = _splitAtWeights(b, usdgIn);
        uint256[] memory minOut = new uint256[](split.length);
        _fundAndApprove(alice, b, usdgIn);

        vm.prank(alice);
        uint256 g0 = gasleft();
        b.mint(usdgIn, split, minOut, 0, alice);
        used = g0 - gasleft();
    }

    // ---- first mint ---------------------------------------------------

    function test_gasFirstMint_feeZero() public {
        emit log_named_uint("A first  feeBps=0", _firstMintGas());
    }

    function test_gasFirstMint_feeThirty() public {
        _setFeeBps(30);
        emit log_named_uint("B first  feeBps=30", _firstMintGas());
    }

    // ---- second mint, cold accrual slots -------------------------------

    function test_gasSecondMint_feeZero() public {
        emit log_named_uint("C second feeBps=0", _secondMintGas());
    }

    function test_gasSecondMint_feeThirty() public {
        _setFeeBps(30);
        emit log_named_uint("D second feeBps=30", _secondMintGas());
    }

    // ---- steady state, accrual slots already warm ----------------------

    /// @dev The cost that actually recurs. The first fee-charging mint for a
    /// given curator pays 20k to open their accrual slot and 20k more for the
    /// protocol slot; every mint after that only rewrites warm storage.
    function test_gasSteadyState_feeThirty() public {
        _setFeeBps(30);
        Basket b = _createDefaultBasket();
        _mintAtWeights(b, bob, 1_000_000_000, 0);
        _mintAtWeights(b, bob, 1_000_000_000, 0);

        uint256 usdgIn = 1_000_000_000;
        uint256[] memory split = _splitAtWeights(b, usdgIn);
        uint256[] memory minOut = new uint256[](split.length);
        _fundAndApprove(alice, b, usdgIn);

        vm.prank(alice);
        uint256 g0 = gasleft();
        b.mint(usdgIn, split, minOut, 0, alice);
        emit log_named_uint("E steady feeBps=30", g0 - gasleft());
    }

    function test_gasSteadyState_feeZero() public {
        Basket b = _createDefaultBasket();
        _mintAtWeights(b, bob, 1_000_000_000, 0);
        _mintAtWeights(b, bob, 1_000_000_000, 0);

        uint256 usdgIn = 1_000_000_000;
        uint256[] memory split = _splitAtWeights(b, usdgIn);
        uint256[] memory minOut = new uint256[](split.length);
        _fundAndApprove(alice, b, usdgIn);

        vm.prank(alice);
        uint256 g0 = gasleft();
        b.mint(usdgIn, split, minOut, 0, alice);
        emit log_named_uint("F steady feeBps=0", g0 - gasleft());
    }
}
