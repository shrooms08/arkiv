import type { Address } from "viem";

import mainnetManifest from "../../../deployments/xlayer-mainnet.json";
import testnetManifest from "../../../deployments/xlayer-testnet.json";

/**
 * Deployed addresses come from the COMMITTED manifests in `deployments/`, not
 * from env vars.
 *
 * That is deliberate: a submission nobody else can reproduce is not a
 * submission. Anyone who clones this repo gets the same addresses the live site
 * uses, and the manifests are filled from the Foundry broadcast artefact rather
 * than typed, so they cannot drift from the chain.
 *
 * `NEXT_PUBLIC_RPC_URL` still overrides the transport, which is what lets the
 * same build run against a local fork.
 */
export type AssetPricing = "pool" | "mock-adapter";

export interface Deployment {
  chainId: number;
  arkiv: Address;
  /** Present only where real V3 pools exist. */
  quoter?: Address;
  /** Present only on a mock deployment; used to price assets instead. */
  mockAdapter?: Address;
  mockUsdg?: Address;
  usdg: Address;
  pricing: AssetPricing;
  usesMockAssets: boolean;
  explorer: string;
  /** symbol -> wrapper address on THIS chain. */
  assets: Record<string, Address>;
}

export interface ManifestBasket {
  index: number;
  symbol: string;
  name: string;
  address: string;
  thesisHash: string | null;
}

interface Manifest {
  chainId: number;
  status: string;
  explorer: string;
  usesMockAssets: boolean;
  contracts: Record<string, string | null>;
  assets: Record<string, string>;
  baskets?: ManifestBasket[];
}

function build(m: Manifest): Deployment | undefined {
  if (m.status !== "deployed") return undefined;
  const arkiv = m.contracts.Arkiv;
  if (!arkiv) return undefined;

  const mockAdapter = m.contracts.MockDexAdapter ?? undefined;
  const mockUsdg = m.contracts.MockUSDG ?? undefined;
  const quoter = m.contracts.ArkivQuoter ?? undefined;

  return {
    chainId: m.chainId,
    arkiv: arkiv as Address,
    quoter: quoter as Address | undefined,
    mockAdapter: mockAdapter as Address | undefined,
    mockUsdg: mockUsdg as Address | undefined,
    // On a mock deployment USDG is the mock; on mainnet it is the real thing.
    usdg: (mockUsdg ?? "0x4ae46a509F6b1D9056937BA4500cb143933D2dc8") as Address,
    pricing: m.usesMockAssets ? "mock-adapter" : "pool",
    usesMockAssets: m.usesMockAssets,
    explorer: m.explorer,
    assets: m.assets as Record<string, Address>,
  };
}

const DEPLOYMENTS: Record<number, Deployment | undefined> = {
  1952: build(testnetManifest as Manifest),
  196: build(mainnetManifest as Manifest),
};

export function deploymentFor(chainId: number | undefined): Deployment | undefined {
  if (chainId === undefined) return undefined;
  return DEPLOYMENTS[chainId];
}

/** Resolve a symbol to its wrapper on the connected chain. */
export function wrapperFor(deployment: Deployment, symbol: string): Address | undefined {
  return deployment.assets[symbol];
}

/** Reverse lookup, for rendering a basket read from chain. */
export function symbolFor(deployment: Deployment, wrapper: Address): string | undefined {
  const target = wrapper.toLowerCase();
  for (const [symbol, address] of Object.entries(deployment.assets)) {
    if (address.toLowerCase() === target) return symbol;
  }
  return undefined;
}

/**
 * Baskets in on-chain creation order, from the committed manifest.
 *
 * Serial numbers are the registry index, so they have to come from creation
 * order rather than from anything the underwriting record knows about itself.
 * Reading the manifest keeps that mapping available to server components
 * without a chain call.
 */
const MANIFEST_BASKETS: ManifestBasket[] = (
  (testnetManifest as Manifest).baskets ?? []
) as ManifestBasket[];

/** 1-based registry index for a ticker, or undefined if it is not on chain. */
/**
 * The serial for a basket address.
 *
 * The serial IS the registry index: ARKIV-000N is the basket at index N-1 in
 * the registry's `baskets` array. It was previously derived from the ticker,
 * which worked only while tickers happened to be unique. They are not, and
 * cannot be, because they are user-supplied: a second basket filed under an
 * existing ticker rendered with the first one's serial.
 */
export function serialForAddress(address: string): number | undefined {
  const hit = MANIFEST_BASKETS.find(
    (b) => b.address.toLowerCase() === address.toLowerCase(),
  );
  return hit ? hit.index + 1 : undefined;
}

/**
 * The serial for a filed thesis, by hash.
 *
 * Resolves to the FIRST basket filed under this hash. A record has one filing
 * that is its own; a later duplicate is a different basket with its own serial
 * and is not what a card about this thesis should point at.
 */
export function serialForThesis(thesisHash: string): number | undefined {
  const hits = MANIFEST_BASKETS.filter((b) => b.thesisHash === thesisHash);
  if (hits.length === 0) return undefined;
  return Math.min(...hits.map((b) => b.index)) + 1;
}

/** Address of the first basket filed under this thesis hash. */
export function basketAddressForThesis(thesisHash: string): string | undefined {
  const hits = MANIFEST_BASKETS.filter((b) => b.thesisHash === thesisHash);
  if (hits.length === 0) return undefined;
  return hits.reduce((a, b) => (a.index <= b.index ? a : b)).address;
}

/** Deployed basket address for a ticker, if it has been created. */
export function basketAddressFor(symbol: string): string | undefined {
  return MANIFEST_BASKETS.find(
    (b) => b.symbol.toLowerCase() === symbol.toLowerCase(),
  )?.address;
}
