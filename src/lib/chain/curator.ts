import type { Address, PublicClient } from "viem";

import { arkivAbi } from "./abis";

/**
 * Curator reads.
 *
 * The record counts CLAIMS, not returns. A return is mostly the market's and
 * mostly luck; a falsifier that was published in advance and did not trigger is
 * evidence about the author. Nothing here reads a price.
 */
export interface CuratorRecord {
  authored: number;
  breached: number;
  standing: number;
}

/** Who filed a basket's thesis, and how their other claims have fared. */
export async function fetchCurator(
  client: PublicClient,
  arkiv: Address,
  basket: Address,
): Promise<{ curator: Address; record: CuratorRecord; breached: boolean } | null> {
  const [creatorRes, breachedRes] = await client.multicall({
    contracts: [
      { address: arkiv, abi: arkivAbi, functionName: "creatorOf", args: [basket] },
      { address: arkiv, abi: arkivAbi, functionName: "breached", args: [basket] },
    ],
    allowFailure: true,
  });

  if (creatorRes?.status !== "success" || typeof creatorRes.result !== "string") return null;
  const curator = creatorRes.result as Address;

  const recordRes = await client.readContract({
    address: arkiv,
    abi: arkivAbi,
    functionName: "curatorRecord",
    args: [curator],
  });

  const [authored, breachedCount, standing] = recordRes as readonly [bigint, bigint, bigint];

  return {
    curator,
    breached: breachedRes?.status === "success" ? Boolean(breachedRes.result) : false,
    record: {
      authored: Number(authored),
      breached: Number(breachedCount),
      standing: Number(standing),
    },
  };
}

/**
 * Breach flags for a page of baskets, in the same order.
 *
 * A failed read comes back `false` rather than throwing: the archive should
 * still list a basket whose flag could not be fetched, and an unbreached-looking
 * row is the same thing the reader sees today.
 */
export async function fetchBreachFlags(
  client: PublicClient,
  arkiv: Address,
  baskets: readonly Address[],
): Promise<boolean[]> {
  if (baskets.length === 0) return [];

  const results = await client.multicall({
    contracts: baskets.map((b) => ({
      address: arkiv,
      abi: arkivAbi,
      functionName: "breached" as const,
      args: [b],
    })),
    allowFailure: true,
  });

  return baskets.map((_, i) => {
    const r = results[i];
    return r?.status === "success" ? Boolean(r.result) : false;
  });
}
