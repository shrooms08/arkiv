import type { Address, PublicClient } from "viem";

import { arkivAbi, basketAbi } from "./abis";

/**
 * Reads the archive from the on-chain array.
 *
 * No `eth_getLogs`, no block ranges, no chunking, no indexer, no RPC tier
 * requirement. `getBaskets(offset, limit)` returns a page of addresses in one
 * call; the per-basket detail reads are then collapsed into a single `eth_call`
 * by Multicall3, which was verified live on chain 196.
 *
 * This works on the public endpoint indefinitely. A log-derived archive would
 * not: the public RPC caps `eth_getLogs` at 100 blocks, so the number of
 * requests needed to reconstruct history grows without bound as the chain does.
 */
export interface ArchiveEntry {
  address: Address;
  name: string;
  symbol: string;
  thesisURI: string;
  createdAt: number;
  totalSupply: bigint;
  tokens: readonly Address[];
  thesisWeightsBps: readonly number[];
}

export const ARCHIVE_PAGE_SIZE = 24;

export async function fetchBasketPage(
  client: PublicClient,
  arkiv: Address,
  offset: number,
  limit: number = ARCHIVE_PAGE_SIZE,
): Promise<Address[]> {
  const page = await client.readContract({
    address: arkiv,
    abi: arkivAbi,
    functionName: "getBaskets",
    args: [BigInt(offset), BigInt(limit)],
  });
  return [...(page as readonly Address[])];
}

export async function fetchBasketCount(client: PublicClient, arkiv: Address): Promise<number> {
  const n = await client.readContract({
    address: arkiv,
    abi: arkivAbi,
    functionName: "basketCount",
  });
  return Number(n);
}

/** One multicall for the whole page — six reads per basket, one request. */
export async function fetchBasketDetails(
  client: PublicClient,
  addresses: readonly Address[],
): Promise<ArchiveEntry[]> {
  if (addresses.length === 0) return [];

  const calls = addresses.flatMap((address) => [
    { address, abi: basketAbi, functionName: "name" as const },
    { address, abi: basketAbi, functionName: "symbol" as const },
    { address, abi: basketAbi, functionName: "thesisURI" as const },
    { address, abi: basketAbi, functionName: "createdAt" as const },
    { address, abi: basketAbi, functionName: "totalSupply" as const },
    { address, abi: basketAbi, functionName: "composition" as const },
  ]);

  const results = await client.multicall({ contracts: calls, allowFailure: true });

  return addresses.map((address, i) => {
    const base = i * 6;
    const pick = <T>(offset: number, fallback: T): T => {
      const r = results[base + offset];
      return r && r.status === "success" ? (r.result as T) : fallback;
    };

    const composition = pick<
      readonly [readonly Address[], readonly number[], readonly bigint[], bigint] | null
    >(5, null);

    return {
      address,
      name: pick<string>(0, "(unreadable)"),
      symbol: pick<string>(1, "?"),
      thesisURI: pick<string>(2, ""),
      createdAt: Number(pick<bigint>(3, 0n)),
      totalSupply: pick<bigint>(4, 0n),
      tokens: composition ? composition[0] : [],
      thesisWeightsBps: composition ? composition[1] : [],
    };
  });
}

/** Full basket state for the detail page. */
export interface BasketState {
  tokens: readonly Address[];
  thesisWeightsBps: readonly number[];
  reserves: readonly bigint[];
  totalSupply: bigint;
  name: string;
  symbol: string;
  thesisURI: string;
  shareBalance: bigint;
}

export async function fetchBasketState(
  client: PublicClient,
  basket: Address,
  holder?: Address,
): Promise<BasketState> {
  const [composition, name, symbol, thesisURI, balance] = await client.multicall({
    contracts: [
      { address: basket, abi: basketAbi, functionName: "composition" },
      { address: basket, abi: basketAbi, functionName: "name" },
      { address: basket, abi: basketAbi, functionName: "symbol" },
      { address: basket, abi: basketAbi, functionName: "thesisURI" },
      {
        address: basket,
        abi: basketAbi,
        functionName: "balanceOf",
        args: [holder ?? "0x0000000000000000000000000000000000000000"],
      },
    ],
    allowFailure: false,
  });

  const [tokens, weights, reserves, supply] = composition as readonly [
    readonly Address[],
    readonly number[],
    readonly bigint[],
    bigint,
  ];

  return {
    tokens,
    thesisWeightsBps: weights,
    reserves,
    totalSupply: supply,
    name: name as string,
    symbol: symbol as string,
    thesisURI: thesisURI as string,
    shareBalance: holder ? (balance as bigint) : 0n,
  };
}
