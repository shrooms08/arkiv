import { defineChain } from "viem";

/**
 * X Layer mainnet. The only chain where the xStocks pools, USDG and the V3 fork
 * actually exist — every address in `src/config/assets.ts` is a mainnet address.
 */
export const xLayer = defineChain({
  id: 196,
  name: "X Layer",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.xlayer.tech"] } },
  blockExplorers: {
    default: { name: "OKLink", url: "https://www.oklink.com/xlayer" },
  },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
});

/**
 * X Layer testnet — chain id **1952**, verified against `testrpc.xlayer.tech`.
 * (Not 195; that was an incorrect assumption in an earlier revision.)
 *
 * The real xStocks wrappers, USDG and V3-fork pools do not exist here, so the
 * testnet deployment runs against MOCKS: a mock USDG with a public faucet, mock
 * wrappers, and a fixed-rate mock adapter. That makes testnet a working
 * demonstration of the mechanism anyone can click through without holding
 * anything real — which is the point — but the assets are not real xStocks and
 * the UI says so on every page.
 */
export const xLayerTestnet = defineChain({
  id: 1952,
  name: "X Layer Testnet",
  testnet: true,
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: ["https://testrpc.xlayer.tech"] } },
  blockExplorers: {
    default: { name: "OKLink", url: "https://www.oklink.com/xlayer-test" },
  },
  // Verified on chain 1952 before being configured, exactly as on mainnet:
  // 3808 bytes of code at the canonical address, and `getBlockNumber()` returns
  // the current head. Without this every `client.multicall` throws
  // "multicallAddress is required" — which breaks the basket and archive pages,
  // since both read composition for several legs at once.
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
});

/**
 * A local anvil node forked from X Layer mainnet. Chain id stays 196 so every
 * mainnet address resolves, but it is served from 127.0.0.1.
 */
export const xLayerFork = defineChain({
  ...xLayer,
  id: 196,
  name: "X Layer (local fork)",
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
});

export const SUPPORTED_CHAINS = [xLayer, xLayerTestnet] as const;

/** True when the connected chain has a deployment we can mint into. */
export function chainHasUniverse(chainId: number | undefined): boolean {
  return chainId === xLayer.id || chainId === xLayerTestnet.id;
}

/** True when the assets on this chain are mocks rather than real xStocks. */
export function chainUsesMocks(chainId: number | undefined): boolean {
  return chainId === xLayerTestnet.id;
}
