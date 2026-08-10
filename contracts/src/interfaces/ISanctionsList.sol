// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Backed's deny-list, live at 0x615Dd3B9445A94334C1579F68115042D77CC7c44.
/// The xStocks *wrappers* do not expose a sanctionsList() getter at all (the call
/// reverts), so Arkiv reads this contract itself rather than assuming the token it
/// custodies screens anybody. See docs/RISKS.md R3.
interface ISanctionsList {
    function isSanctioned(address addr) external view returns (bool);
}
