// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IDexAdapter} from "./IDexAdapter.sol";

interface IArkiv {
    function usdg() external view returns (address);
    function dexAdapter() external view returns (IDexAdapter);
    function mintCap() external view returns (uint256);

    /// @notice Floor on the USDG of a basket's FIRST mint, so a basket can never
    /// be opened at a dust basis.
    function minFirstMint() external view returns (uint256);

    function paused() external view returns (bool);

    /// @notice Mint fee in basis points, charged on the USDG coming in.
    /// @dev Hard-capped in the registry so the owner cannot raise it arbitrarily.
    /// There is deliberately no redemption fee — see R10.
    function feeBps() external view returns (uint256);

    /// @notice Reverts if this mint must not proceed. Called by baskets before
    /// pulling any funds.
    function checkMint(address minter, address receiver, uint256 usdgIn) external view;

    /// @notice Book a mint fee the caller has already transferred to the registry.
    /// @dev Callable only by a basket this registry deployed. Splits the fee
    /// between the basket's curator and the protocol, and routes the whole
    /// amount to the protocol once the basket's falsifier has been breached.
    function recordFee(uint256 amount) external;
}
