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

/**
 * The default chain, and the demo.
 *
 * Arkiv is deployed on both X Layer testnet and X Layer mainnet. Testnet is
 * where the seven filed theses live and is what a visitor sees without a
 * wallet, so it stays the default. Mainnet is real and empty.
 *
 * This used to be the ONLY deployed chain, and writes were pinned to it
 * exactly. That is no longer true: see `isDeployedChain`.
 */
export const ACTIVE_CHAIN = xLayerTestnet;

/** Every chain Arkiv is actually deployed on. Writes are allowed on these. */
export const DEPLOYED_CHAIN_IDS: readonly number[] = [xLayerTestnet.id, xLayer.id];

/**
 * True on a chain the contracts actually live on.
 *
 * Deliberately not "a chain wagmi is configured with": that set is broader and
 * has included chains with nothing deployed on them, which is how a write once
 * got built for a chain that could never have executed it.
 */
export function isDeployedChain(chainId: number | undefined): boolean {
  return chainId !== undefined && DEPLOYED_CHAIN_IDS.includes(chainId);
}

/** Retained for call sites that mean the default chain specifically. */
export function isActiveChain(chainId: number | undefined): boolean {
  return chainId === ACTIVE_CHAIN.id;
}

/** The chain object for an id, where Arkiv is deployed on it. */
export function chainById(chainId: number | undefined) {
  return SUPPORTED_CHAINS.find((c) => c.id === chainId);
}

/** True where the assets are mocks rather than real Backed xStocks. */
export function chainIsTestnet(chainId: number | undefined): boolean {
  return chainId === xLayerTestnet.id;
}

/**
 * Human name for whatever chain a wallet turned up on, so a prompt can say
 * where the user actually is rather than just "wrong network".
 *
 * Only the chains someone plausibly has selected are named. Anything else gets
 * its id, which is honest and still actionable, rather than a guessed name.
 */
const FOREIGN_CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum Mainnet",
  10: "OP Mainnet",
  56: "BNB Smart Chain",
  137: "Polygon",
  8453: "Base",
  42161: "Arbitrum One",
  43114: "Avalanche",
  11155111: "Sepolia",
};

export function chainLabel(chainId: number | undefined): string {
  if (chainId === undefined) return "an unknown network";
  const configured = SUPPORTED_CHAINS.find((c) => c.id === chainId);
  if (configured) return `${configured.name} (chain ${chainId})`;
  const known = FOREIGN_CHAIN_NAMES[chainId];
  return known ? `${known} (chain ${chainId})` : `chain ${chainId}`;
}

/** True when the connected chain has a deployment we can mint into. */
export function chainHasUniverse(chainId: number | undefined): boolean {
  return chainId === xLayer.id || chainId === xLayerTestnet.id;
}

/** True when the assets on this chain are mocks rather than real xStocks. */
export function chainUsesMocks(chainId: number | undefined): boolean {
  return chainId === xLayerTestnet.id;
}
