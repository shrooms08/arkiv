import type { Address, PublicClient } from "viem";

import { ASSETS, DEX, USDG, assetByAddress } from "@/config/assets";
import { quoterAbi } from "./abis";

/**
 * Exit value — what a holding could actually be sold for right now, priced off
 * the pool it would be sold into.
 *
 * This is NOT a reference market price and must never be labelled as one. Pyth is
 * absent from X Layer and we did not add an external feed; instead each leg is
 * quoted against its own USDG pool, so the number already contains the depth the
 * user would actually hit. For a basket that redeems in kind out of these exact
 * pools, that is the more honest figure — and it will differ from the equity's
 * quoted price, which is information rather than an error.
 *
 * Quotes are `eth_call` only. `quoteExactInput` is non-view because it calls
 * `swap`, but the quoter's callback always reverts, so nothing can change state.
 */
export interface LegExitValue {
  symbol: string;
  wrapper: Address;
  /** USDG (6dp) per 1e18 wrapper units. `null` when the leg cannot be quoted. */
  usdgPerUnit: bigint | null;
  /** Why it could not be quoted, for the UI's explicit unavailable state. */
  unavailableReason?: string;
}

/** ~$100, the notional the quoter is sized against. */
const NOTIONAL_USDG = 100_000_000n;

/**
 * Prices every allowlisted asset. A leg that cannot be quoted comes back with
 * `usdgPerUnit: null` and a reason — never 0. A zero exit value rendered as a
 * number reads as "this is worthless", which is a different and much worse claim
 * than "we could not price this".
 */
export async function fetchExitValues(
  client: PublicClient,
  quoter: Address,
  wrappers: readonly Address[] = ASSETS.map((a) => a.wrapper as Address),
): Promise<Map<Address, LegExitValue>> {
  const results = new Map<Address, LegExitValue>();

  // Step 1: size each sell to roughly $100 by asking what $100 buys.
  const buyQuotes = await client.multicall({
    contracts: wrappers.map((w) => ({
      address: quoter,
      abi: quoterAbi,
      functionName: "quoteExactInput" as const,
      args: [USDG.address as Address, w, DEX.defaultFeeTier, NOTIONAL_USDG],
    })),
    allowFailure: true,
  });

  // Step 2: quote selling those units back.
  const sellTargets: { wrapper: Address; units: bigint }[] = [];
  wrappers.forEach((w, i) => {
    const q = buyQuotes[i];
    const asset = assetByAddress(w);
    const symbol = asset?.symbol ?? w;

    if (!q || q.status !== "success" || typeof q.result !== "bigint" || q.result === 0n) {
      results.set(w, {
        symbol,
        wrapper: w,
        usdgPerUnit: null,
        unavailableReason: "No liquidity in this pool right now.",
      });
      return;
    }
    sellTargets.push({ wrapper: w, units: q.result });
  });

  if (sellTargets.length > 0) {
    const sellQuotes = await client.multicall({
      contracts: sellTargets.map((t) => ({
        address: quoter,
        abi: quoterAbi,
        functionName: "exitValuePerUnit" as const,
        args: [t.wrapper, USDG.address as Address, DEX.defaultFeeTier, t.units],
      })),
      allowFailure: true,
    });

    sellTargets.forEach((t, i) => {
      const q = sellQuotes[i];
      const symbol = assetByAddress(t.wrapper)?.symbol ?? t.wrapper;
      if (!q || q.status !== "success" || typeof q.result !== "bigint" || q.result === 0n) {
        results.set(t.wrapper, {
          symbol,
          wrapper: t.wrapper,
          usdgPerUnit: null,
          unavailableReason: "Pool could not fill a sell quote.",
        });
        return;
      }
      results.set(t.wrapper, { symbol, wrapper: t.wrapper, usdgPerUnit: q.result });
    });
  }

  return results;
}

/**
 * Value of a leg's holdings in USDG base units.
 * `units` is 18dp wrapper units; `usdgPerUnit` is USDG-6dp per 1e18 units.
 */
export function valueOfLeg(units: bigint, usdgPerUnit: bigint | null): bigint | null {
  if (usdgPerUnit === null) return null;
  return (units * usdgPerUnit) / 10n ** 18n;
}

/**
 * Composition by VALUE, with an explicit unpriced bucket.
 *
 * Legs that could not be priced are excluded from the percentages and reported
 * separately, so the UI can say "3 of 4 legs priced" instead of silently showing
 * weights that do not add up to what the user holds.
 */
export function valueComposition(
  legs: { wrapper: Address; units: bigint }[],
  prices: Map<Address, LegExitValue>,
): {
  total: bigint;
  priced: { wrapper: Address; value: bigint; bps: number }[];
  unpriced: Address[];
} {
  const priced: { wrapper: Address; value: bigint }[] = [];
  const unpriced: Address[] = [];

  for (const leg of legs) {
    const value = valueOfLeg(leg.units, prices.get(leg.wrapper)?.usdgPerUnit ?? null);
    if (value === null) unpriced.push(leg.wrapper);
    else priced.push({ wrapper: leg.wrapper, value });
  }

  const total = priced.reduce((a, p) => a + p.value, 0n);
  return {
    total,
    priced: priced.map((p) => ({
      ...p,
      bps: total === 0n ? 0 : Number((p.value * 10_000n) / total),
    })),
    unpriced,
  };
}
