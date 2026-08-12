// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";

import {Arkiv} from "../src/Arkiv.sol";
import {Basket} from "../src/Basket.sol";
import {MockUSDG} from "../src/mocks/TestnetMocks.sol";

/**
 * Adds one basket to an EXISTING registry, and seeds it the same way
 * DeployTestnet seeds the rest: mint $500, redeem half.
 *
 * Basket creation is permissionless, so a thesis that clears validation after
 * the initial deploy joins the archive with one transaction. No redeploy, no new
 * addresses for anything already live, and the serial is simply the next index.
 *
 *   forge script script/AddBasket.s.sol \
 *     --rpc-url https://testrpc.xlayer.tech --broadcast \
 *     --private-key $DEPLOYER_PRIVATE_KEY
 */
contract AddBasket is Script {
    // Live testnet deployment, chain 1952.
    Arkiv internal constant ARKIV = Arkiv(0xB2e78cf1194BdFd8bb0e2C8A0BBF0d6146f7659c);
    MockUSDG internal constant USDG = MockUSDG(0x11b8B3D85b228923f37495D82d25f51eA2834EBa);

    // CAPEXPAY, legs ascending by address as createBasket requires.
    // QQQx 25 / SPYx 25 / MSFTx 30 / GOOGLx 20
    address internal constant QQQX = 0x04c5AF1C2f347B3CE4fa4AaCD336532e1f421c8B;
    address internal constant SPYX = 0x0D0Ea0b297c05372665Ca3c4a6B9ff6c57896773;
    address internal constant MSFTX = 0x88d5a2a46D7eE439724229fda8472B8a852aab17;
    address internal constant GOOGLX = 0xEE3bdD82cf891ebF1DD18b420AD4426bD2eb7421;

    function run() external {
        vm.startBroadcast();

        address[] memory tokens = new address[](4);
        tokens[0] = QQQX;
        tokens[1] = SPYX;
        tokens[2] = MSFTX;
        tokens[3] = GOOGLX;

        uint16[] memory weights = new uint16[](4);
        weights[0] = 2500; // QQQx
        weights[1] = 2500; // SPYx
        weights[2] = 3000; // MSFTx, primary expression
        weights[3] = 2000; // GOOGLx

        address basket = ARKIV.createBasket(
            "AI Capex Reckoning: Seat-Licence Advantage",
            "CAPEXPAY",
            tokens,
            weights,
            "arkiv:7e991c5b1e0fda63"
        );

        // The faucet is rate limited to one pull an hour, so top up only if the
        // deployer is short of the seed amount.
        uint256 usdgIn = 500_000_000;
        if (USDG.balanceOf(tx.origin) < usdgIn) USDG.faucet();

        (, uint256 netUsdgIn) = ARKIV.quoteMintFee(usdgIn);

        uint256[] memory split = new uint256[](4);
        uint256 assigned;
        for (uint256 i; i < 4; ++i) {
            split[i] = i == 3 ? netUsdgIn - assigned : (netUsdgIn * weights[i]) / 10_000;
            assigned += split[i];
        }

        USDG.approve(basket, usdgIn);
        uint256 shares = Basket(basket).mint(usdgIn, split, new uint256[](4), 0, tx.origin);
        Basket(basket).redeem(shares / 2, tx.origin, new uint256[](4));

        console.log("CAPEXPAY        ", basket);
        console.log("basketCount     ", ARKIV.basketCount());
        console.log("curatorEarnings ", ARKIV.curatorEarnings(tx.origin));
        console.log("protocolEarnings", ARKIV.protocolEarnings());

        vm.stopBroadcast();
    }
}
