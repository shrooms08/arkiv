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
 * X Layer testnet.
 *
 * Included for wallet/network plumbing only. **The protocol cannot actually run
 * here**: xStocks wrappers, USDG and the V3-fork pools are not deployed on
 * testnet, so there is nothing to swap into. A basket minted on testnet would
 * have no underlying. The app therefore lets you connect on testnet and tells you
 * plainly that the universe is absent, rather than pretending.
 *
 * Real end-to-end verification runs against a LOCAL FORK of mainnet, where the
 * pools are real — see `anvil` in contracts/README.md.
 */
export const xLayerTestnet = defineChain({
  id: 195,
  name: "X Layer Testnet",
  testnet: true,
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: ["https://testrpc.xlayer.tech"] } },
  blockExplorers: {
    default: { name: "OKLink", url: "https://www.oklink.com/xlayer-test" },
  },
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

/** True when the connected chain can actually mint — i.e. the universe exists. */
export function chainHasUniverse(chainId: number | undefined): boolean {
  return chainId === 196;
}
