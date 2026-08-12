import type { Address, PublicClient } from "viem";

import { arkivAbi, basketAbi, erc20Abi } from "./abis";
import { fetchBasketCount, fetchBasketPage } from "./archive";
import type { Deployment } from "./deployments";

export interface HeldBasket {
  address: Address;
  shares: bigint;
}

export interface PositionDetail {
  address: Address;
  shares: bigint;
  symbol: string;
  name: string;
  totalSupply: bigint;
  tokens: readonly Address[];
  reserves: readonly bigint[];
  createdAt: number;
  breached: boolean;
  curator: Address | undefined;
}

/** What redeeming this position would pay out, per leg. */
export interface InKindLeg {
  wrapper: Address;
  units: bigint;
}

/**
 * Which baskets this address holds, and how much.
 *
 * Two rounds, not one call per basket. The registry is enumerated in a page,
 * then every balance is read in a single multicall. Six baskets today, but the
 * shape is what matters: this stays one round trip whether the registry holds
 * six entries or six hundred, and the expensive detail reads that follow only
 * touch the baskets that came back non-zero.
 *
 * Zero balances are dropped here rather than downstream, so nothing further
 * down ever has to decide whether an empty position is worth rendering.
 */
export async function fetchHeldBaskets(
  client: PublicClient,
  deployment: Deployment,
  holder: Address,
): Promise<HeldBasket[]> {
  const count = await fetchBasketCount(client, deployment.arkiv);
  if (count === 0) return [];

  const addresses: Address[] = [];
  const PAGE = 200;
  for (let offset = 0; offset < count; offset += PAGE) {
    addresses.push(
      ...(await fetchBasketPage(client, deployment.arkiv, offset, Math.min(PAGE, count - offset))),
    );
  }

  const balances = await client.multicall({
    contracts: addresses.map((address) => ({
      address,
      abi: erc20Abi,
      functionName: "balanceOf" as const,
      args: [holder],
    })),
    allowFailure: true,
  });

  const held: HeldBasket[] = [];
  addresses.forEach((address, i) => {
    const r = balances[i];
    if (r?.status === "success" && typeof r.result === "bigint" && r.result > 0n) {
      held.push({ address, shares: r.result });
    }
  });
  return held;
}

/**
 * Everything else a position row needs, in one multicall.
 *
 * Breach and curator are read from the registry in the same batch as the basket
 * reads, because splitting them would double the round trips for no gain. A
 * failed individual read degrades that field rather than the row: a position the
 * holder owns should still render if, say, the curator lookup fails.
 */
export async function fetchPositionDetails(
  client: PublicClient,
  deployment: Deployment,
  held: readonly HeldBasket[],
): Promise<PositionDetail[]> {
  if (held.length === 0) return [];

  const PER_BASKET = 6;
  const calls = held.flatMap(({ address }) => [
    { address, abi: basketAbi, functionName: "name" as const },
    { address, abi: basketAbi, functionName: "symbol" as const },
    { address, abi: basketAbi, functionName: "totalSupply" as const },
    { address, abi: basketAbi, functionName: "composition" as const },
    { address, abi: basketAbi, functionName: "createdAt" as const },
    { address: deployment.arkiv, abi: arkivAbi, functionName: "breached" as const, args: [address] },
  ]);

  const curatorCalls = held.map(({ address }) => ({
    address: deployment.arkiv,
    abi: arkivAbi,
    functionName: "creatorOf" as const,
    args: [address],
  }));

  const results = await client.multicall({
    contracts: [...calls, ...curatorCalls],
    allowFailure: true,
  });

  return held.map((h, i) => {
    const base = i * PER_BASKET;
    const pick = <T>(offset: number, fallback: T): T => {
      const r = results[base + offset];
      return r && r.status === "success" ? (r.result as T) : fallback;
    };
    const composition = pick<
      readonly [readonly Address[], readonly number[], readonly bigint[], bigint] | null
    >(3, null);
    const curatorResult = results[held.length * PER_BASKET + i];

    return {
      address: h.address,
      shares: h.shares,
      name: pick<string>(0, ""),
      symbol: pick<string>(1, ""),
      totalSupply: pick<bigint>(2, 0n),
      tokens: composition ? composition[0] : [],
      reserves: composition ? composition[2] : [],
      createdAt: Number(pick<bigint>(4, 0n)),
      breached: Boolean(pick<boolean>(5, false)),
      curator:
        curatorResult?.status === "success" ? (curatorResult.result as Address) : undefined,
    };
  });
}

/**
 * The legs and amounts redeeming would pay out, pro rata.
 *
 * This mirrors the contract's own arithmetic rather than approximating it:
 * `units_i = reserves_i * shares / totalSupply`, floored, which is what the
 * holder actually receives. It is a preview of a real payout, not a valuation,
 * so it stays exact and has no price in it at all.
 */
export function inKindFor(position: PositionDetail): InKindLeg[] {
  if (position.totalSupply === 0n) return [];
  return position.tokens.map((wrapper, i) => ({
    wrapper,
    units: ((position.reserves[i] ?? 0n) * position.shares) / position.totalSupply,
  }));
}
