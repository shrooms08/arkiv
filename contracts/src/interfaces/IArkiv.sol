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

    /// @notice Reverts if this mint must not proceed. Called by baskets before
    /// pulling any funds.
    function checkMint(address minter, address receiver, uint256 usdgIn) external view;
}
