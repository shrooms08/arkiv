// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";

import {Arkiv} from "../src/Arkiv.sol";
import {Basket} from "../src/Basket.sol";
import {XLayerConfig} from "../src/config/XLayerConfig.sol";
import {MockDexAdapter, MockSanctionsList, MockUSDG, MockWrapper} from "../src/mocks/TestnetMocks.sol";

/**
 * Deploys the full protocol to X Layer testnet (chain 1952) against mocks, seeds
 * the sample baskets, and mints and redeems on each, so the deployment that gets
 * verified is one that has demonstrably worked rather than one that compiled.
 *
 * Economics are live in this deployment: feeBps 30, curatorBps 5000, attestor
 * set. The curator on every basket is the deployer, because the deployer is the
 * address calling createBasket. That is a testnet artefact and is disclosed as
 * one in the README, not a claim about how curation works.
 *
 *   forge script script/DeployTestnet.s.sol \
 *     --rpc-url https://testrpc.xlayer.tech --broadcast \
 *     --private-key $DEPLOYER_PRIVATE_KEY
 */
contract DeployTestnet is Script {
    /// Shipping defaults, asserted rather than assumed. If a constructor default
    /// ever drifts, the deploy should fail here and not on a live basket.
    uint256 internal constant EXPECTED_FEE_BPS = 30;
    uint256 internal constant EXPECTED_CURATOR_BPS = 5000;

    /// Prices in USDG base units (6dp). These are the EXIT VALUES measured
    /// against the real mainnet pools by `ForkQuoter.t.sol`, not round numbers.
    /// A mock that returns realistic prices demonstrates the mechanism; a mock
    /// returning $100.00 for everything looks like a toy.
    function prices() internal pure returns (uint256[14] memory p) {
        p[0] = 397_983_581; // GLDx
        p[1] = 723_103_866; // QQQx
        p[2] = 777_050_280; // SPYx
        p[3] = 301_959_676; // IWMx
        p[4] = 223_734_240; // NVDAx
        p[5] = 327_984_850; // TSLAx
        p[6] = 505_355_839; // MSFTx
        p[7] = 274_080_897; // AMZNx
        p[8] = 152_364_898; // COINx
        p[9] = 598_075_584; // METAx
        p[10] = 431_695_316; // AVGOx
        p[11] = 356_140_481; // GOOGLx
        p[12] = 307_603_025; // AAPLx
        p[13] = 472_755_816; // AMDx
    }

    /// Wrapper units (18dp) delivered per USDG base unit (6dp), 1e18 fixed point.
    /// `amountOut = amountIn * rate / 1e18`, so $1 must buy 1/price of a token:
    /// 1e6 * rate / 1e18 = 1e24 / priceBaseUnits  =>  rate = 1e36 / priceBaseUnits.
    function rateFor(uint256 priceBaseUnits) internal pure returns (uint256) {
        return 1e36 / priceBaseUnits;
    }

    MockUSDG internal usdg;
    MockDexAdapter internal adapter;
    Arkiv internal arkiv;
    address[14] internal wrappers;

    function run() external {
        vm.startBroadcast();
        address deployer = tx.origin;

        usdg = new MockUSDG();
        MockSanctionsList sanctions = new MockSanctionsList();
        adapter = new MockDexAdapter(address(usdg), deployer);

        string[] memory syms = XLayerConfig.symbols();
        uint256[14] memory p = prices();
        bool[] memory isCore = XLayerConfig.isCoreFlags();

        arkiv = new Arkiv(
            address(usdg),
            address(sanctions),
            address(adapter),
            XLayerConfig.MINT_CAP,
            XLayerConfig.MIN_FIRST_MINT,
            deployer
        );

        // Economics, live. The constructor already sets these; asserting makes a
        // silent drift in the defaults a failed deploy rather than a basket that
        // charges the wrong fee.
        require(arkiv.feeBps() == EXPECTED_FEE_BPS, "feeBps is not 30");
        require(arkiv.curatorBps() == EXPECTED_CURATOR_BPS, "curatorBps is not 5000");
        require(arkiv.attestor() == deployer, "attestor is not the deployer");

        for (uint256 i; i < 14; ++i) {
            wrappers[i] = address(
                new MockWrapper(
                    string.concat("Mock ", syms[i], " xStock"), syms[i], address(adapter)
                )
            );
            adapter.setRate(wrappers[i], rateFor(p[i]));
            arkiv.setAssetAllowed(wrappers[i], true, isCore[i]);
        }

        console.log("MockUSDG        ", address(usdg));
        console.log("MockSanctionsList", address(sanctions));
        console.log("MockDexAdapter  ", address(adapter));
        console.log("Arkiv           ", address(arkiv));
        console.log("feeBps          ", arkiv.feeBps());
        console.log("curatorBps      ", arkiv.curatorBps());
        console.log("attestor        ", arkiv.attestor());
        for (uint256 i; i < 14; ++i) {
            console.log(syms[i], wrappers[i]);
        }

        // Two faucet pulls: $10,000 each, and five baskets take $2,500 of mints.
        usdg.faucet();

        // Serial 1. NVDAx 25 / AVGOx 20 / SPYx 30 / QQQx 25
        _seed(
            "AI Infrastructure Bottleneck Capture",
            "AIBOTTLE",
            _idx4(4, 10, 2, 1),
            _w4(2500, 2000, 3000, 2500),
            "arkiv:e4d242a38e509390"
        );

        // Serial 2. GLDx 35 / SPYx 25 / QQQx 10 / IWMx 10 / AMZNx 10 / AVGOx 10
        _seed(
            "Sticky Inflation, Central Bank Blink",
            "STICKYINF",
            _idx6(0, 2, 1, 3, 7, 10),
            _w6(3500, 2500, 1000, 1000, 1000, 1000),
            "arkiv:2563e23afaa8d654"
        );

        // Serial 3. IWMx 50 / SPYx 30 / QQQx 20
        _seed(
            "Small Cap Rate Relief with Index Hedge",
            "SCRATE",
            _idx3(3, 2, 1),
            _w3(5000, 3000, 2000),
            "arkiv:de82aadb08bef443"
        );

        // Serial 4. METAx 20 / GOOGLx 15 / SPYx 25 / QQQx 25 / AMZNx 15
        _seed(
            "Distribution Scarcity: AI Shifts Value to the Pipe",
            "ATTENTION",
            _idx5(9, 11, 2, 1, 7),
            _w5(2000, 1500, 2500, 2500, 1500),
            "arkiv:aa23e27493ef8119"
        );

        // Serial 5. AAPLx 25 / MSFTx 15 / AVGOx 10 / GLDx 25 / SPYx 25
        _seed(
            "On-Device Inference: Value Shifts from Cloud to Edge",
            "EDGEAI",
            _idx5(12, 6, 10, 0, 2),
            _w5(2500, 1500, 1000, 2500, 2500),
            "arkiv:9b7ca9022c510d89"
        );

        console.log("curatorEarnings ", arkiv.curatorEarnings(deployer));
        console.log("protocolEarnings", arkiv.protocolEarnings());

        vm.stopBroadcast();
    }

    /// Creates, mints $500, then redeems half.
    /// @dev The split must cover the POST-FEE amount. Sizing it to the gross
    /// reverts with SplitMismatch, which is the contract refusing to spend money
    /// it no longer holds.
    function _seed(
        string memory name,
        string memory symbol,
        uint256[] memory idx,
        uint16[] memory weights,
        string memory thesisURI
    ) internal {
        address[] memory tokens = new address[](idx.length);
        for (uint256 i; i < idx.length; ++i) {
            tokens[i] = wrappers[idx[i]];
        }
        _sort(tokens, weights);

        address basket = arkiv.createBasket(name, symbol, tokens, weights, thesisURI);

        uint256 usdgIn = 500_000_000;
        (, uint256 netUsdgIn) = arkiv.quoteMintFee(usdgIn);

        uint256[] memory split = new uint256[](tokens.length);
        uint256 assigned;
        for (uint256 i; i < tokens.length; ++i) {
            split[i] = i == tokens.length - 1 ? netUsdgIn - assigned : (netUsdgIn * weights[i]) / 10_000;
            assigned += split[i];
        }

        usdg.approve(basket, usdgIn);
        uint256 shares =
            Basket(basket).mint(usdgIn, split, new uint256[](tokens.length), 0, tx.origin);
        Basket(basket).redeem(shares / 2, tx.origin, new uint256[](tokens.length));

        console.log(symbol, basket);
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

    function _idx3(uint256 a, uint256 b, uint256 c) private pure returns (uint256[] memory r) {
        r = new uint256[](3);
        (r[0], r[1], r[2]) = (a, b, c);
    }

    function _idx4(uint256 a, uint256 b, uint256 c, uint256 d)
        private
        pure
        returns (uint256[] memory r)
    {
        r = new uint256[](4);
        (r[0], r[1], r[2], r[3]) = (a, b, c, d);
    }

    function _idx5(uint256 a, uint256 b, uint256 c, uint256 d, uint256 e)
        private
        pure
        returns (uint256[] memory r)
    {
        r = new uint256[](5);
        (r[0], r[1], r[2], r[3], r[4]) = (a, b, c, d, e);
    }

    function _idx6(uint256 a, uint256 b, uint256 c, uint256 d, uint256 e, uint256 f)
        private
        pure
        returns (uint256[] memory r)
    {
        r = new uint256[](6);
        (r[0], r[1], r[2], r[3], r[4], r[5]) = (a, b, c, d, e, f);
    }

    function _w3(uint16 a, uint16 b, uint16 c) private pure returns (uint16[] memory r) {
        r = new uint16[](3);
        (r[0], r[1], r[2]) = (a, b, c);
    }

    function _w4(uint16 a, uint16 b, uint16 c, uint16 d) private pure returns (uint16[] memory r) {
        r = new uint16[](4);
        (r[0], r[1], r[2], r[3]) = (a, b, c, d);
    }

    function _w5(uint16 a, uint16 b, uint16 c, uint16 d, uint16 e)
        private
        pure
        returns (uint16[] memory r)
    {
        r = new uint16[](5);
        (r[0], r[1], r[2], r[3], r[4]) = (a, b, c, d, e);
    }

    function _w6(uint16 a, uint16 b, uint16 c, uint16 d, uint16 e, uint16 f)
        private
        pure
        returns (uint16[] memory r)
    {
        r = new uint16[](6);
        (r[0], r[1], r[2], r[3], r[4], r[5]) = (a, b, c, d, e, f);
    }
}
