// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Arkiv} from "../src/Arkiv.sol";
import {XLayerV3Adapter} from "../src/XLayerV3Adapter.sol";
import {ArkivQuoter} from "../src/ArkivQuoter.sol";
import {XLayerConfig} from "../src/config/XLayerConfig.sol";

/// @notice Deploys the adapter and registry and wires the full 14-asset universe.
///
/// Registration is not a formality: `registerPair` proves each pool twice — the
/// CREATE2 derivation must have code, and the factory's own registry must return
/// the same address — so a deploy against a wrong factory, a wrong init code hash
/// or a stale pool list reverts here rather than at the first mint.
///
/// Usage:
///   forge script script/Deploy.s.sol --rpc-url xlayer --broadcast
contract Deploy is Script {
    function run() external returns (Arkiv arkiv, XLayerV3Adapter adapter, ArkivQuoter quoter) {
        vm.startBroadcast();

        // The broadcasting account must own both contracts while they are being
        // configured, because `registerPair` and `setAssetAllowed` are
        // `onlyOwner`. Handing over to a different owner therefore happens at
        // the END, through Ownable2Step — which the recipient must then accept.
        address deployer = tx.origin;
        address finalOwner = vm.envOr("ARKIV_OWNER", deployer);

        adapter = new XLayerV3Adapter(XLayerConfig.V3_FACTORY, XLayerConfig.POOL_INIT_CODE_HASH, deployer);

        address[] memory wrappers = XLayerConfig.wrappers();
        for (uint256 i; i < wrappers.length; ++i) {
            adapter.registerPair(XLayerConfig.USDG, wrappers[i], XLayerConfig.FEE_TIER);
        }

        arkiv = new Arkiv(
            XLayerConfig.USDG,
            XLayerConfig.SANCTIONS_LIST,
            address(adapter),
            XLayerConfig.MINT_CAP,
            XLayerConfig.MIN_FIRST_MINT,
            deployer
        );

        bool[] memory isCore = XLayerConfig.isCoreFlags();
        for (uint256 i; i < wrappers.length; ++i) {
            // Reverts if the token answers multiplier(), i.e. if a base token
            // was ever pasted in where a wrapper belongs.
            arkiv.setAssetAllowed(wrappers[i], true, isCore[i]);
        }

        // Read-only pricing for the UI. Ownerless and holds nothing: its swap
        // callback always reverts, so there is nothing to configure or protect.
        quoter = new ArkivQuoter(XLayerConfig.V3_FACTORY, XLayerConfig.POOL_INIT_CODE_HASH);

        if (finalOwner != deployer) {
            arkiv.transferOwnership(finalOwner);
            adapter.transferOwnership(finalOwner);
        }

        vm.stopBroadcast();

        console.log("Arkiv       ", address(arkiv));
        console.log("Adapter     ", address(adapter));
        console.log("Quoter      ", address(quoter));
        console.log("Owner       ", arkiv.owner());
        console.log("Pending owner", arkiv.pendingOwner());
        console.log("Mint cap    ", XLayerConfig.MINT_CAP);
        console.log("Min 1st mint", XLayerConfig.MIN_FIRST_MINT);
        console.log("Assets      ", wrappers.length);
    }
}
