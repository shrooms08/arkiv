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
 * The chain this build is deployed against.
 *
 * Everything that writes must happen here and nowhere else. `SUPPORTED_CHAINS`
 * is what wagmi is configured with, which is a broader set: X Layer mainnet is
 * configured so the app can render there, but nothing is deployed on it, so a
 * write sent from it would fail exactly as one sent from Ethereum would.
 */
export const ACTIVE_CHAIN = xLayerTestnet;

/** True only on the chain the contracts actually live on. */
export function isActiveChain(chainId: number | undefined): boolean {
  return chainId === ACTIVE_CHAIN.id;
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
