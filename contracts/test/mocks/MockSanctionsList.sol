// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

contract MockSanctionsList {
    mapping(address => bool) public sanctioned;

    function set(address account, bool value) external {
        sanctioned[account] = value;
    }

    function isSanctioned(address account) external view returns (bool) {
        return sanctioned[account];
    }
}
