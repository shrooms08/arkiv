/**
 * Arkiv asset universe — X Layer mainnet (chain 196).
 *
 * SINGLE SOURCE OF TRUTH. Every address here was verified on-chain, not taken
 * from the Backed registry. See docs/FINDINGS.md for the verification method.
 *
 * Rules encoded here:
 *  - Wrappers only. The vault never holds a rebasing base token. `base` is
 *    recorded ONLY so we can explicitly reject it; never add it to the allowlist.
 *  - Match assets by ADDRESS, never by symbol. Decoy ERC-20s named "xStocks"
 *    exist on X Layer with their own pools. See docs/RISKS.md.
 */

export const CHAIN_ID = 196 as const;
export const CHAIN_NAME = "X Layer" as const;

/** Global Dollar (Paxos). NOTE: 6 decimals, not 18. */
export const USDG = {
  address: "0x4ae46a509F6b1D9056937BA4500cb143933D2dc8",
  symbol: "USDG",
  decimals: 6,
} as const;

/**
 * Uniswap V3 fork. Canonical Uniswap is NOT deployed on X Layer; this factory
 * is the one that actually owns every xStocks/USDG pool. No trusted router was
 * identified, so the adapter swaps against the pool directly.
 */
export const DEX = {
  factory: "0x4B2ab38DBF28D31D467aA8993f6c2585981D6804",
  /** Every live xStocks/USDG pool sits on the 0.05% tier. */
  defaultFeeTier: 500,
} as const;

/** Backed's sanctions deny-list. Live and callable; read it ourselves. */
export const SANCTIONS_LIST =
  "0x615Dd3B9445A94334C1579F68115042D77CC7c44" as const;

export const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11" as const;

export type AssetRole = "core" | "tilt";

export interface Asset {
  readonly symbol: string;
  readonly onChainSymbol: string;
  readonly label: string;
  readonly role: AssetRole;
  readonly wrapper: string;
  readonly base: string;
  readonly pool: string;
  readonly feeTier: number;
  readonly decimals: number;
  readonly usdgReserve: number;
  readonly impactBps: { at1k: number; at5k: number; at10k: number };
}

export const ASSETS: readonly Asset[] = [
  {
    symbol: "GLDx",
    onChainSymbol: "wGLDx",
    label: "Gold",
    role: "core",
    wrapper: "0x735f1509Bff25e27Cd442B9bFb231324648eAD9B",
    base: "0x2380F2673C640fB67E2d6B55B44C62F0E0e69DA9",
    pool: "0x47cc42825C2f0c8BE1638dFAd6015f7Cc9026a3d",
    feeTier: 500,
    decimals: 18,
    /** USDG-side pool reserve, measured 2026-08-10 */
    usdgReserve: 279749,
    /** measured slippage in bps at $1k / $5k / $10k, fork-executed, excludes the 5bp pool fee */
    impactBps: { at1k: 5, at5k: 22, at10k: 43 },
  },
  {
    symbol: "QQQx",
    onChainSymbol: "wQQQx",
    label: "Nasdaq 100",
    role: "core",
    wrapper: "0x4C1AE29c159838fC1b224636E28E086EB69101f7",
    base: "0xa753A7395cAe905Cd615Da0B82A53E0560f250af",
    pool: "0xF2b620d2d05d04A05FB32Cd71B075Af4726dB3A6",
    feeTier: 500,
    decimals: 18,
    /** USDG-side pool reserve, measured 2026-08-10 */
    usdgReserve: 252207,
    /** measured slippage in bps at $1k / $5k / $10k, fork-executed, excludes the 5bp pool fee */
    impactBps: { at1k: 12, at5k: 59, at10k: 115 },
  },
  {
    symbol: "SPYx",
    onChainSymbol: "wSPYx",
    label: "S&P 500",
    role: "core",
    wrapper: "0xE7E553Cd128F0011777323A0b44a7b96EA1CB540",
    base: "0x90A2a4c76b5D8c0bc892A69EA28Aa775a8f2dD48",
    pool: "0x07c40850D14064D20eB0AfDEf9574675392f2c11",
    feeTier: 500,
    decimals: 18,
    /** USDG-side pool reserve, measured 2026-08-10 */
    usdgReserve: 250961,
    /** measured slippage in bps at $1k / $5k / $10k, fork-executed, excludes the 5bp pool fee */
    impactBps: { at1k: 12, at5k: 59, at10k: 116 },
  },
  {
    symbol: "IWMx",
    onChainSymbol: "wIWMx",
    label: "Russell 2000",
    role: "core",
    wrapper: "0x25d218F19B706C8680Aa26Fb64e676CF84B58f65",
    base: "0xdadfb355c6110eda0908740d52c834d6C2BCDDc7",
    pool: "0x2c80222Ed9461EF22526653e3F858Db3F76F2EFf",
    feeTier: 500,
    decimals: 18,
    /** USDG-side pool reserve, measured 2026-08-10 */
    usdgReserve: 236278,
    /** measured slippage in bps at $1k / $5k / $10k, fork-executed, excludes the 5bp pool fee */
    impactBps: { at1k: 13, at5k: 62, at10k: 123 },
  },
  {
    symbol: "NVDAx",
    onChainSymbol: "wNVDAx",
    label: "NVIDIA",
    role: "tilt",
    wrapper: "0xa8ddb5Cd96b5222AFe198316E9A57CAA642850D5",
    base: "0xc845b2894dBddd03858fd2D643B4eF725fE0849d",
    pool: "0x2a2B11730C2b6d99a58034A869dd810D7300a7b2",
    feeTier: 500,
    decimals: 18,
    /** USDG-side pool reserve, measured 2026-08-10 */
    usdgReserve: 110762,
    /** measured slippage in bps at $1k / $5k / $10k, fork-executed, excludes the 5bp pool fee */
    impactBps: { at1k: 17, at5k: 107, at10k: 394 },
  },
  {
    symbol: "TSLAx",
    onChainSymbol: "wTSLAx",
    label: "Tesla",
    role: "tilt",
    wrapper: "0xc3FdBe3A68EE5dE461D30415a8165cf9Aefe1171",
    base: "0x8aD3c73F833d3F9A523aB01476625F269aEB7Cf0",
    pool: "0xe1071DB4691b325c709854DC3D5CcD5d77e62Ed1",
    feeTier: 500,
    decimals: 18,
    /** USDG-side pool reserve, measured 2026-08-10 */
    usdgReserve: 106799,
    /** measured slippage in bps at $1k / $5k / $10k, fork-executed, excludes the 5bp pool fee */
    impactBps: { at1k: 41, at5k: 198, at10k: 380 },
  },
  {
    symbol: "MSFTx",
    onChainSymbol: "wMSFTx",
    label: "Microsoft",
    role: "tilt",
    wrapper: "0x166Fbe68274b6a47e025F4ba17388c539f1fa1d0",
    base: "0x5621737f42dAE558b81269FcB9E9E70c19Aa6b35",
    pool: "0x66187278490a70A8aC26a6E159EB045F82DbFb57",
    feeTier: 500,
    decimals: 18,
    /** USDG-side pool reserve, measured 2026-08-10 */
    usdgReserve: 102582,
    /** measured slippage in bps at $1k / $5k / $10k, fork-executed, excludes the 5bp pool fee */
    impactBps: { at1k: 43, at5k: 205, at10k: 393 },
  },
  {
    symbol: "AMZNx",
    onChainSymbol: "wAMZNx",
    label: "Amazon",
    role: "tilt",
    wrapper: "0x910cabdE3EBa7Fc1Ce64fD14bD680b9f60fA0F90",
    base: "0x3557Ba345B01EFa20A1bdDC61F573BFD87195081",
    pool: "0x8C1C0d559D1C7AE6ed921cC77abd0f26aC2FE59a",
    feeTier: 500,
    decimals: 18,
    /** USDG-side pool reserve, measured 2026-08-10 */
    usdgReserve: 102404,
    /** measured slippage in bps at $1k / $5k / $10k, fork-executed, excludes the 5bp pool fee */
    impactBps: { at1k: 43, at5k: 205, at10k: 393 },
  },
  {
    symbol: "COINx",
    onChainSymbol: "wCOINx",
    label: "Coinbase",
    role: "tilt",
    wrapper: "0x44C7eD7fFDF8465c9d27F60AEC845EEd3d49d56e",
    base: "0x364f210f430eC2448Fc68A49203040F6124096F0",
    pool: "0xFD69Fd884BD7c35DF86D2eC80ae74Cbe774C00ab",
    feeTier: 500,
    decimals: 18,
    /** USDG-side pool reserve, measured 2026-08-10 */
    usdgReserve: 101636,
    /** measured slippage in bps at $1k / $5k / $10k, fork-executed, excludes the 5bp pool fee */
    impactBps: { at1k: 43, at5k: 206, at10k: 395 },
  },
  {
    symbol: "METAx",
    onChainSymbol: "wMETAx",
    label: "Meta",
    role: "tilt",
    wrapper: "0xe840946FfEBCd66B7C4E95095effaFaDfa0D0e56",
    base: "0x96702be57Cd9777f835117a809C7124fe4ec989A",
    pool: "0xfAD9e3C7550768fd4f34Bc9CEFD365CC193C0fB0",
    feeTier: 500,
    decimals: 18,
    /** USDG-side pool reserve, measured 2026-08-10 */
    usdgReserve: 101432,
    /** measured slippage in bps at $1k / $5k / $10k, fork-executed, excludes the 5bp pool fee */
    impactBps: { at1k: 43, at5k: 206, at10k: 395 },
  },
  {
    symbol: "AVGOx",
    onChainSymbol: "wAVGOx",
    label: "Broadcom",
    role: "tilt",
    wrapper: "0xE89572bfe500ac7E8Ecd8dc8119d274214e06F14",
    base: "0x38BAC69cbBd28156796e4163B2B6dcb81E336565",
    pool: "0x7142e1a5C79A441Ba274EB0438E984a7aA8d5ac9",
    feeTier: 500,
    decimals: 18,
    /** USDG-side pool reserve, measured 2026-08-10 */
    usdgReserve: 100704,
    /** measured slippage in bps at $1k / $5k / $10k, fork-executed, excludes the 5bp pool fee */
    impactBps: { at1k: 43, at5k: 207, at10k: 397 },
  },
  {
    symbol: "GOOGLx",
    onChainSymbol: "wGOOGLx",
    label: "Alphabet",
    role: "tilt",
    wrapper: "0xf8c5308F80E459bb53d9EbE689854d9cBb2Caa6f",
    base: "0xe92f673Ca36C5E2Efd2DE7628f815f84807e803F",
    pool: "0x8CE66218A6310765307e7ab2d11BcfF7cC2ea1F1",
    feeTier: 500,
    decimals: 18,
    /** USDG-side pool reserve, measured 2026-08-10 */
    usdgReserve: 98557,
    /** measured slippage in bps at $1k / $5k / $10k, fork-executed, excludes the 5bp pool fee */
    impactBps: { at1k: 43, at5k: 208, at10k: 399 },
  },
  {
    symbol: "AAPLx",
    onChainSymbol: "wAAPLx",
    label: "Apple",
    role: "tilt",
    wrapper: "0x943BF64D566c32A2Bcd41AC92FB63C111cC9De8f",
    base: "0x9d275685dC284C8eB1C79f6ABA7a63Dc75ec890a",
    pool: "0xc44bd9c8589026D28D1632d7b86b2Efb6cDc8fd2",
    feeTier: 500,
    decimals: 18,
    /** USDG-side pool reserve, measured 2026-08-10 */
    usdgReserve: 97952,
    /** measured slippage in bps at $1k / $5k / $10k, fork-executed, excludes the 5bp pool fee */
    impactBps: { at1k: 43, at5k: 209, at10k: 400 },
  },
  {
    symbol: "AMDx",
    onChainSymbol: "wAMDx",
    label: "AMD",
    role: "tilt",
    wrapper: "0xEe7CcB0d37A12862e7f92F6C92a93d9c2d304266",
    base: "0x3522513E5F146a2006e2901b05f16B2821485E19",
    pool: "0x853B01E6626aD3D4e6EaeF5eDB5AC50e53b1dA40",
    feeTier: 500,
    decimals: 18,
    /** USDG-side pool reserve, measured 2026-08-10 */
    usdgReserve: 94219,
    /** measured slippage in bps at $1k / $5k / $10k, fork-executed, excludes the 5bp pool fee */
    impactBps: { at1k: 58, at5k: 279, at10k: 527 },
  },
] as const;

/**
 * Verified as deployed on X Layer but EXCLUDED: no USDG pool, or a pool with
 * zero reserves. Kept here so nobody "rediscovers" them from the registry.
 *
 * Addresses recorded 2026-08-10 (Gate 1). Re-verified directly against chain
 * 196: every wrapper below returns `totalSupply() == 0` and
 * `factory.getPool(USDG, wrapper, 500) == address(0)`. Excluded means excluded —
 * they are absent from ASSETS and therefore from ALLOWLIST, not merely ranked
 * last. Listing them by address is what stops a future edit from re-adding one
 * on the strength of its registry entry.
 */
export const EXCLUDED = [
  {
    symbol: "VTIx",
    wrapper: "0x2eE96832126dC446808BaBcbCc9A04905114f880",
    base: "0xbD730E618bcD88C82dDeE52e10275CF2f88A4777",
    reason: "wrapper totalSupply 0, no USDG pool",
  },
  {
    symbol: "VOOx",
    wrapper: "0x64E225C84B80c7DAB7Ef2094a81A461a13F960C1",
    base: "0xFfAE0B911CB2cb7B49FD75011D99D137C040A9eF",
    reason: "wrapper totalSupply 0, no USDG pool",
  },
  {
    symbol: "SLVx",
    wrapper: "0xB842EacB35Fd9c1bEDA53749072Ef22823f2cA8c",
    base: "0x4833e7f4f0460f4B72A3a5879A6C9841bCC5B58B",
    reason: "wrapper totalSupply 0, no USDG pool",
  },
  {
    symbol: "JPMx",
    wrapper: "0x15302e0D167EfBcf61129125C89035411842809B",
    base: "0xD9FC3E075d45254a1D834fEa18AF8041207DeA0A",
    reason: "wrapper totalSupply 0, no USDG pool",
  },
  {
    symbol: "LLYx",
    wrapper: "0x9daea2fe63D4C8A7DF8373909fccB27b640f9516",
    base: "0x19c41EA77b34BbDEe61c3A87A75D1ABDA2ED0be4",
    reason: "wrapper totalSupply 0, no USDG pool",
  },
  {
    symbol: "UNHx",
    wrapper: "0x1F652b05eFB825a068304972BC506Fb43Fac4D6F",
    base: "0x167A6375DA1eFc4a5BE0f470E73eCEfd66245048",
    reason: "wrapper totalSupply 0, no USDG pool",
  },
] as const;

/** Excluded wrapper addresses, lowercased. Never allowlist any of these. */
export const EXCLUDED_WRAPPERS: readonly string[] = EXCLUDED.map((e) =>
  e.wrapper.toLowerCase(),
);

export const CORE_ASSETS = ASSETS.filter((a) => a.role === "core");
export const TILT_ASSETS = ASSETS.filter((a) => a.role === "tilt");

/** Lowercased wrapper addresses — the on-chain allowlist. */
export const ALLOWLIST: readonly string[] = ASSETS.map((a) =>
  a.wrapper.toLowerCase(),
);

/** Symbols the AI underwriter is permitted to emit. */
export const ALLOWED_SYMBOLS: readonly string[] = ASSETS.map((a) => a.symbol);

/**
 * Index assets must be at least this share of a basket.
 *
 * This is a LIQUIDITY rule, not a style rule: core assets sit in the deepest
 * pools, so the floor is what keeps mint slippage inside the 200 bp budget. It
 * is enforced on-chain in `Arkiv.createBasket` because it protects execution.
 *
 * There is deliberately no ceiling. A ceiling was tried and removed: it was
 * doing product work (stopping a boring 90%-index basket) under a risk label,
 * and it collided with the floor whenever the deepest asset was also the most
 * direct expression of the thesis — a small-cap view through IWMx, which is
 * simultaneously the liquidity anchor and the point. Expression is now enforced
 * by `primaryExpression` in the underwriting schema, which is the constraint
 * that was actually wanted.
 */
export const MIN_CORE_BPS = 5000 as const;

/**
 * The primary expression holding must carry at least this weight. This is what
 * stops a basket that technically satisfies the allowlist from failing to
 * express anything.
 */
export const MIN_PRIMARY_EXPRESSION_BPS = 1500 as const;

/**
 * `core` and `tilt` mean liquidity depth to us and read as style labels to a
 * user — a mismatch that actively misleads, since IWMx is "core" while a
 * small-cap bet is a tilt in ordinary usage. Never show the raw role.
 */
export const ROLE_LABEL: Record<AssetRole, string> = {
  core: "Liquidity anchor",
  tilt: "Thesis expression",
};

/** Launch mint cap, in USDG base units (6 decimals) = $5,000. */
export const MINT_CAP_USDG = 5_000_000_000n;

/** Block a mint whose blended slippage exceeds this. */
export const MAX_BLENDED_IMPACT_BPS = 200 as const;

const BY_SYMBOL = new Map(ASSETS.map((a) => [a.symbol, a]));
const BY_ADDRESS = new Map(ASSETS.map((a) => [a.wrapper.toLowerCase(), a]));

export function assetBySymbol(symbol: string): Asset | undefined {
  return BY_SYMBOL.get(symbol);
}

export function assetByAddress(address: string): Asset | undefined {
  return BY_ADDRESS.get(address.toLowerCase());
}

export function isAllowed(address: string): boolean {
  return BY_ADDRESS.has(address.toLowerCase());
}
