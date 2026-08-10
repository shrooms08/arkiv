// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Verified X Layer (chain 196) constants — the Solidity mirror of
/// src/config/assets.ts. Every address was read from the chain, not transcribed
/// from the Backed registry. See docs/FINDINGS.md.
///
/// @dev Keep in sync with src/config/assets.ts. `AssetsParity.t.sol` is not able
/// to read the TypeScript file, so the sync is manual and the addresses here are
/// re-verified against the live factory by the fork tests: every wrapper's pool
/// must both CREATE2-derive and be confirmed by `factory.getPool`.
library XLayerConfig {
    uint256 internal constant CHAIN_ID = 196;

    /// @notice Global Dollar (Paxos). SIX decimals, not eighteen.
    address internal constant USDG = 0x4ae46a509F6b1D9056937BA4500cb143933D2dc8;
    uint8 internal constant USDG_DECIMALS = 6;

    /// @notice $5,000 in USDG base units.
    uint256 internal constant MINT_CAP = 5_000_000_000;

    /// @notice $10 in USDG base units — the floor on a basket's FIRST mint, so no
    /// basket is ever opened at a dust basis.
    uint256 internal constant MIN_FIRST_MINT = 10_000_000;

    /// @notice The Uniswap V3 fork that owns every live xStocks/USDG pool.
    /// Canonical Uniswap is not deployed on chain 196.
    address internal constant V3_FACTORY = 0x4B2ab38DBF28D31D467aA8993f6c2585981D6804;

    /// @notice This fork deploys pools with the CANONICAL Uniswap V3 init code
    /// hash. Established by CREATE2 reproduction against all 14 live pools, not
    /// assumed. See ForkPoolDerivation.t.sol.
    bytes32 internal constant POOL_INIT_CODE_HASH = 0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54;

    /// @notice Every live xStocks/USDG pool sits on the 0.05% tier.
    uint24 internal constant FEE_TIER = 500;

    /// @notice Backed's deny-list. The wrappers do not expose a getter for it.
    address internal constant SANCTIONS_LIST = 0x615Dd3B9445A94334C1579F68115042D77CC7c44;

    // -- Core (index and gold) ------------------------------------------------
    // GLDx is core: at $279,749 USDG it is the deepest pool in the universe and
    // gold as a liquid anchor is what makes macro theses expressible.
    address internal constant W_GLDX = 0x735f1509Bff25e27Cd442B9bFb231324648eAD9B;
    address internal constant W_QQQX = 0x4C1AE29c159838fC1b224636E28E086EB69101f7;
    address internal constant W_SPYX = 0xE7E553Cd128F0011777323A0b44a7b96EA1CB540;
    address internal constant W_IWMX = 0x25d218F19B706C8680Aa26Fb64e676CF84B58f65;

    // -- Tilt (single names) --------------------------------------------------
    address internal constant W_NVDAX = 0xa8ddb5Cd96b5222AFe198316E9A57CAA642850D5;
    address internal constant W_TSLAX = 0xc3FdBe3A68EE5dE461D30415a8165cf9Aefe1171;
    address internal constant W_MSFTX = 0x166Fbe68274b6a47e025F4ba17388c539f1fa1d0;
    address internal constant W_AMZNX = 0x910cabdE3EBa7Fc1Ce64fD14bD680b9f60fA0F90;
    address internal constant W_COINX = 0x44C7eD7fFDF8465c9d27F60AEC845EEd3d49d56e;
    address internal constant W_METAX = 0xe840946FfEBCd66B7C4E95095effaFaDfa0D0e56;
    address internal constant W_AVGOX = 0xE89572bfe500ac7E8Ecd8dc8119d274214e06F14;
    address internal constant W_GOOGLX = 0xf8c5308F80E459bb53d9EbE689854d9cBb2Caa6f;
    address internal constant W_AAPLX = 0x943BF64D566c32A2Bcd41AC92FB63C111cC9De8f;
    address internal constant W_AMDX = 0xEe7CcB0d37A12862e7f92F6C92a93d9c2d304266;

    // -- Base tokens: REBASING. Recorded only so they can be rejected. --------
    address internal constant B_GLDX = 0x2380F2673C640fB67E2d6B55B44C62F0E0e69DA9;
    address internal constant B_SPYX = 0x90A2a4c76b5D8c0bc892A69EA28Aa775a8f2dD48;
    address internal constant B_NVDAX = 0xc845b2894dBddd03858fd2D643B4eF725fE0849d;

    /// @notice All 14 allowlisted wrappers, core first.
    function wrappers() internal pure returns (address[] memory a) {
        a = new address[](14);
        a[0] = W_GLDX;
        a[1] = W_QQQX;
        a[2] = W_SPYX;
        a[3] = W_IWMX;
        a[4] = W_NVDAX;
        a[5] = W_TSLAX;
        a[6] = W_MSFTX;
        a[7] = W_AMZNX;
        a[8] = W_COINX;
        a[9] = W_METAX;
        a[10] = W_AVGOX;
        a[11] = W_GOOGLX;
        a[12] = W_AAPLX;
        a[13] = W_AMDX;
    }

    /// @notice Parallel to `wrappers()`: true for the four core assets.
    function isCoreFlags() internal pure returns (bool[] memory f) {
        f = new bool[](14);
        f[0] = true; // GLDx
        f[1] = true; // QQQx
        f[2] = true; // SPYx
        f[3] = true; // IWMx
    }

    /// @notice The pool addresses recorded during Gate 0 recon, parallel to
    /// `wrappers()`. Fork tests assert each of these equals both the CREATE2
    /// derivation and the factory's own `getPool`.
    function pools() internal pure returns (address[] memory p) {
        p = new address[](14);
        p[0] = 0x47cc42825C2f0c8BE1638dFAd6015f7Cc9026a3d; // GLDx
        p[1] = 0xF2b620d2d05d04A05FB32Cd71B075Af4726dB3A6; // QQQx
        p[2] = 0x07c40850D14064D20eB0AfDEf9574675392f2c11; // SPYx
        p[3] = 0x2c80222Ed9461EF22526653e3F858Db3F76F2EFf; // IWMx
        p[4] = 0x2a2B11730C2b6d99a58034A869dd810D7300a7b2; // NVDAx
        p[5] = 0xe1071DB4691b325c709854DC3D5CcD5d77e62Ed1; // TSLAx
        p[6] = 0x66187278490a70A8aC26a6E159EB045F82DbFb57; // MSFTx
        p[7] = 0x8C1C0d559D1C7AE6ed921cC77abd0f26aC2FE59a; // AMZNx
        p[8] = 0xFD69Fd884BD7c35DF86D2eC80ae74Cbe774C00ab; // COINx
        p[9] = 0xfAD9e3C7550768fd4f34Bc9CEFD365CC193C0fB0; // METAx
        p[10] = 0x7142e1a5C79A441Ba274EB0438E984a7aA8d5ac9; // AVGOx
        p[11] = 0x8CE66218A6310765307e7ab2d11BcfF7cC2ea1F1; // GOOGLx
        p[12] = 0xc44bd9c8589026D28D1632d7b86b2Efb6cDc8fd2; // AAPLx
        p[13] = 0x853B01E6626aD3D4e6EaeF5eDB5AC50e53b1dA40; // AMDx
    }

    /// @notice Deployed on X Layer but EXCLUDED: wrapper `totalSupply()` is 0
    /// and there is no USDG pool on any tier. Recorded by address so a later
    /// edit cannot re-add one on the strength of its registry entry — registry
    /// presence is not liquidity. `ForkDeploy.t.sol` re-proves both facts.
    function excludedWrappers() internal pure returns (address[] memory a) {
        a = new address[](6);
        a[0] = 0x2eE96832126dC446808BaBcbCc9A04905114f880; // VTIx
        a[1] = 0x64E225C84B80c7DAB7Ef2094a81A461a13F960C1; // VOOx
        a[2] = 0xB842EacB35Fd9c1bEDA53749072Ef22823f2cA8c; // SLVx
        a[3] = 0x15302e0D167EfBcf61129125C89035411842809B; // JPMx
        a[4] = 0x9daea2fe63D4C8A7DF8373909fccB27b640f9516; // LLYx
        a[5] = 0x1F652b05eFB825a068304972BC506Fb43Fac4D6F; // UNHx
    }

    function excludedSymbols() internal pure returns (string[] memory s) {
        s = new string[](6);
        s[0] = "VTIx";
        s[1] = "VOOx";
        s[2] = "SLVx";
        s[3] = "JPMx";
        s[4] = "LLYx";
        s[5] = "UNHx";
    }

    function symbols() internal pure returns (string[] memory s) {
        s = new string[](14);
        s[0] = "GLDx";
        s[1] = "QQQx";
        s[2] = "SPYx";
        s[3] = "IWMx";
        s[4] = "NVDAx";
        s[5] = "TSLAx";
        s[6] = "MSFTx";
        s[7] = "AMZNx";
        s[8] = "COINx";
        s[9] = "METAx";
        s[10] = "AVGOx";
        s[11] = "GOOGLx";
        s[12] = "AAPLx";
        s[13] = "AMDx";
    }
}
