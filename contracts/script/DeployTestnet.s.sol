// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";

import {Arkiv} from "../src/Arkiv.sol";
import {Basket} from "../src/Basket.sol";
import {XLayerConfig} from "../src/config/XLayerConfig.sol";
import {MockDexAdapter, MockSanctionsList, MockUSDG, MockWrapper} from "../src/mocks/TestnetMocks.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * Deploys the full protocol to X Layer testnet (chain 1952) against mocks, then
 * seeds the three sample baskets and exercises a mint and a redeem on each — so
 * the deployment that gets verified is one that has demonstrably worked, not one
 * that merely compiled.
 *
 *   forge script script/DeployTestnet.s.sol --rpc-url https://testrpc.xlayer.tech \
 *     --broadcast --private-key $DEPLOYER_PRIVATE_KEY
 */
contract DeployTestnet is Script {
    // Rate = wrapper units per USDG base unit, 18-dp. 1e30 means $1 buys one
    // whole 18-dp token, so a rate of 1e30/price gives a token worth `price`.
    function rateFor(uint256 priceUsd) internal pure returns (uint256) {
        return 1e30 / priceUsd;
    }

    struct Deployed {
        MockUSDG usdg;
        MockSanctionsList sanctions;
        MockDexAdapter adapter;
        Arkiv arkiv;
        address[8] wrappers;
        string[8] symbols;
    }

    function run() external {
        vm.startBroadcast();
        address deployer = tx.origin;

        // ---- mocks -----------------------------------------------------
        MockUSDG usdg = new MockUSDG();
        MockSanctionsList sanctions = new MockSanctionsList();
        MockDexAdapter adapter = new MockDexAdapter(address(usdg), deployer);

        // Eight assets: enough for all three sample baskets. Prices roughly
        // match the mainnet exit values so the demo reads plausibly.
        string[8] memory syms = ["GLDx", "QQQx", "SPYx", "IWMx", "NVDAx", "AVGOx", "MSFTx", "AMDx"];
        string[8] memory names = [
            "Mock Gold xStock",
            "Mock Nasdaq 100 xStock",
            "Mock S&P 500 xStock",
            "Mock Russell 2000 xStock",
            "Mock NVIDIA xStock",
            "Mock Broadcom xStock",
            "Mock Microsoft xStock",
            "Mock AMD xStock"
        ];
        uint256[8] memory prices = [uint256(398), 723, 777, 302, 224, 432, 505, 473];
        bool[8] memory isCore = [true, true, true, true, false, false, false, false];

        address[8] memory wrappers;
        for (uint256 i; i < 8; ++i) {
            wrappers[i] = address(new MockWrapper(names[i], syms[i], address(adapter)));
            adapter.setRate(wrappers[i], rateFor(prices[i]));
        }

        // ---- protocol --------------------------------------------------
        Arkiv arkiv = new Arkiv(
            address(usdg),
            address(sanctions),
            address(adapter),
            XLayerConfig.MINT_CAP,
            XLayerConfig.MIN_FIRST_MINT,
            deployer
        );
        for (uint256 i; i < 8; ++i) {
            arkiv.setAssetAllowed(wrappers[i], true, isCore[i]);
        }

        console.log("MockUSDG        ", address(usdg));
        console.log("MockSanctions   ", address(sanctions));
        console.log("MockDexAdapter  ", address(adapter));
        console.log("Arkiv           ", address(arkiv));
        for (uint256 i; i < 8; ++i) {
            console.log(syms[i], wrappers[i]);
        }

        Deployed memory d = Deployed(usdg, sanctions, adapter, arkiv, wrappers, syms);

        // ---- seed the three sample baskets, then use each ---------------
        usdg.faucet();

        _seedAibottle(d);
        _seedStickyinf(d);
        _seedScrate(d);

        vm.stopBroadcast();
    }

    /// AIBOTTLE — NVDAx 25 / AVGOx 20 / SPYx 30 / QQQx 25
    function _seedAibottle(Deployed memory d) internal {
        address[] memory tokens = new address[](4);
        uint16[] memory weights = new uint16[](4);
        (tokens, weights) = _sorted4(
            [d.wrappers[4], d.wrappers[5], d.wrappers[2], d.wrappers[1]],
            [uint16(2500), 2000, 3000, 2500]
        );
        _createAndUse(d, "AI Infrastructure Bottleneck", "AIBOTTLE", tokens, weights, "arkiv:e4d242a38e509390");
    }

    /// STICKYINF — GLDx 35 / SPYx 25 / QQQx 10 / IWMx 10 / AVGOx 10 / MSFTx 10
    function _seedStickyinf(Deployed memory d) internal {
        address[6] memory raw = [d.wrappers[0], d.wrappers[2], d.wrappers[1], d.wrappers[3], d.wrappers[5], d.wrappers[6]];
        uint16[6] memory rawW = [uint16(3500), 2500, 1000, 1000, 1000, 1000];
        (address[] memory tokens, uint16[] memory weights) = _sorted6(raw, rawW);
        _createAndUse(d, "Sticky Inflation, Central Bank Blink", "STICKYINF", tokens, weights, "arkiv:2563e23afaa8d654");
    }

    /// SCRATE — IWMx 50 / SPYx 30 / QQQx 20
    function _seedScrate(Deployed memory d) internal {
        address[3] memory raw = [d.wrappers[3], d.wrappers[2], d.wrappers[1]];
        uint16[3] memory rawW = [uint16(5000), 3000, 2000];
        (address[] memory tokens, uint16[] memory weights) = _sorted3(raw, rawW);
        _createAndUse(d, "Small Cap Rate Relief with Index Hedge", "SCRATE", tokens, weights, "arkiv:de82aadb08bef443");
    }

    /// Creates the basket, mints $500, then redeems half — so the deployed
    /// artefact is one that has provably worked end to end.
    function _createAndUse(
        Deployed memory d,
        string memory name,
        string memory symbol,
        address[] memory tokens,
        uint16[] memory weights,
        string memory thesisURI
    ) internal {
        address basket = d.arkiv.createBasket(name, symbol, tokens, weights, thesisURI);

        uint256 usdgIn = 500_000_000; // $500
        uint256[] memory split = new uint256[](tokens.length);
        uint256 assigned;
        for (uint256 i; i < tokens.length; ++i) {
            split[i] = i == tokens.length - 1 ? usdgIn - assigned : (usdgIn * weights[i]) / 10_000;
            assigned += split[i];
        }

        d.usdg.approve(basket, usdgIn);
        uint256 shares = Basket(basket).mint(
            usdgIn, split, new uint256[](tokens.length), 0, tx.origin
        );

        Basket(basket).redeem(shares / 2, tx.origin, new uint256[](tokens.length));

        console.log(symbol, basket);
    }

    // Arkiv requires strictly ascending leg addresses. Insertion sort, kept
    // explicit per arity because Solidity has no generic fixed-array sort.
    function _sorted3(address[3] memory a, uint16[3] memory w)
        internal
        pure
        returns (address[] memory t, uint16[] memory outW)
    {
        t = new address[](3);
        outW = new uint16[](3);
        for (uint256 i; i < 3; ++i) {
            (t[i], outW[i]) = (a[i], w[i]);
        }
        _sort(t, outW);
    }

    function _sorted4(address[4] memory a, uint16[4] memory w)
        internal
        pure
        returns (address[] memory t, uint16[] memory outW)
    {
        t = new address[](4);
        outW = new uint16[](4);
        for (uint256 i; i < 4; ++i) {
            (t[i], outW[i]) = (a[i], w[i]);
        }
        _sort(t, outW);
    }

    function _sorted6(address[6] memory a, uint16[6] memory w)
        internal
        pure
        returns (address[] memory t, uint16[] memory outW)
    {
        t = new address[](6);
        outW = new uint16[](6);
        for (uint256 i; i < 6; ++i) {
            (t[i], outW[i]) = (a[i], w[i]);
        }
        _sort(t, outW);
    }

    function _sort(address[] memory t, uint16[] memory w) private pure {
        for (uint256 i = 1; i < t.length; ++i) {
            address kt = t[i];
            uint16 kw = w[i];
            uint256 j = i;
            while (j > 0 && t[j - 1] > kt) {
                t[j] = t[j - 1];
                w[j] = w[j - 1];
                --j;
            }
            t[j] = kt;
            w[j] = kw;
        }
    }
}
