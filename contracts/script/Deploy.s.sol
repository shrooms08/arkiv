// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Arkiv} from "../src/Arkiv.sol";
import {XLayerV3Adapter} from "../src/XLayerV3Adapter.sol";
import {ArkivQuoter} from "../src/ArkivQuoter.sol";
import {XLayerConfig} from "../src/config/XLayerConfig.sol";

/// @notice Deploys the adapter and registry and wires the full 14-asset universe.
///
/// Registration is not a formality: `registerPair` proves each pool twice - the
/// CREATE2 derivation must have code, and the factory's own registry must return
/// the same address - so a deploy against a wrong factory, a wrong init code hash
/// or a stale pool list reverts here rather than at the first mint.
///
/// No mocks are deployed. USDG, the sanctions list, the V3 factory and all 14
/// wrappers already exist on chain 196 and are used directly.
///
/// No baskets are seeded. `minFirstMint` is 10 USDG per basket and this deploy
/// carries none, so the deliverable is an empty permissionless registry that any
/// funded address can file against.
///
/// Usage:
///   forge script script/Deploy.s.sol --rpc-url xlayer --broadcast
contract Deploy is Script {
    /// The shipping defaults. Asserted after deployment rather than trusted,
    /// because a field initializer is exactly the kind of thing that gets
    /// changed in one place and assumed everywhere else.
    uint256 internal constant EXPECTED_FEE_BPS = 30;
    uint256 internal constant EXPECTED_CURATOR_BPS = 5000;

    function run() external returns (Arkiv arkiv, XLayerV3Adapter adapter, ArkivQuoter quoter) {
        vm.startBroadcast();

        // The broadcasting account must own both contracts while they are being
        // configured, because `registerPair` and `setAssetAllowed` are
        // `onlyOwner`. Handing over to a different owner therefore happens at
        // the END, through Ownable2Step - which the recipient must then accept.
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

        // Assert the economics rather than trusting the constructor. If any of
        // these three is wrong the deploy fails here, while the registry is
        // still empty and nothing has been filed against it.
        require(arkiv.feeBps() == EXPECTED_FEE_BPS, "feeBps is not 30");
        require(arkiv.curatorBps() == EXPECTED_CURATOR_BPS, "curatorBps is not 5000");
        require(arkiv.attestor() == deployer, "attestor is not the deployer");

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
        console.log("Attestor    ", arkiv.attestor());
        console.log("feeBps      ", arkiv.feeBps());
        console.log("curatorBps  ", arkiv.curatorBps());
        console.log("Mint cap    ", XLayerConfig.MINT_CAP);
        console.log("Min 1st mint", XLayerConfig.MIN_FIRST_MINT);
        console.log("Assets      ", wrappers.length);
        console.log("Baskets     ", arkiv.basketCount());
    }
}
