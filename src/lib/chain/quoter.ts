import type { Address, PublicClient } from "viem";

import { DEX, USDG, assetBySymbol } from "@/config/assets";

/**
 * The quoter's read surface, hand-declared as `view`.
 *
 * `quoteExactInput` and `exitValuePerUnit` are `nonpayable` in the compiled ABI
 * because they call `pool.swap()` — but the quoter's callback reverts
 * unconditionally, so the swap is always unwound and no state can change. They
 * are only ever reached through `eth_call`.
 *
 * Declaring them `view` here is what lets them go through `multicall`, which is
 * the difference between one request and 2N against a 10-deep batch limit. It is
 * accurate about behaviour even though it differs from the compiler's
 * conservative mutability inference.
 */
export const quoterReadAbi = [
  {
    type: "function",
    name: "quoteExactInput",
    stateMutability: "view",
    inputs: [
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "fee", type: "uint24" },
      { name: "amountIn", type: "uint256" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
  {
    type: "function",
    name: "exitValuePerUnit",
    stateMutability: "view",
    inputs: [
      { name: "token", type: "address" },
      { name: "usdg", type: "address" },
      { name: "fee", type: "uint24" },
      { name: "unitsToQuote", type: "uint256" },
    ],
    outputs: [{ name: "usdgPerUnit", type: "uint256" }],
  },
] as const;

export interface LegQuote {
  symbol: string;
  wrapper: Address;
  usdgIn: bigint;
  /** Units the leg would receive. `null` when the pool cannot fill. */
  unitsOut: bigint | null;
  /** Slippage vs a small reference trade, in bps. `null` when unquotable. */
  impactBps: number | null;
}

/** $10 reference trade — small enough that its own impact is negligible. */
const REFERENCE_USDG = 10_000_000n;

/**
 * Live per-leg price impact, measured the same way Gate 0 measured it: compare
 * the realised rate at the leg's actual size against the rate on a tiny
 * reference trade. The pool fee cancels between the two, so this is pure
 * slippage.
 *
 * Both quotes for every leg go out in a single multicall.
 */
export async function fetchMintQuotes(
  client: PublicClient,
  quoter: Address,
  legs: { symbol: string; usdgIn: bigint }[],
): Promise<{ legs: LegQuote[]; blendedBps: number | null }> {
  const wrappers = legs.map((l) => assetBySymbol(l.symbol)?.wrapper as Address | undefined);

  const contracts = legs.flatMap((leg, i) => {
    const wrapper = wrappers[i];
    if (!wrapper) return [];
    return [
      {
        address: quoter,
        abi: quoterReadAbi,
        functionName: "quoteExactInput" as const,
        args: [USDG.address as Address, wrapper, DEX.defaultFeeTier, leg.usdgIn],
      },
      {
        address: quoter,
        abi: quoterReadAbi,
        functionName: "quoteExactInput" as const,
        args: [USDG.address as Address, wrapper, DEX.defaultFeeTier, REFERENCE_USDG],
      },
    ];
  });

  const results = await client.multicall({ contracts, allowFailure: true });

  let weightedImpact = 0;
  let quotedNotional = 0n;

  const out: LegQuote[] = legs.map((leg, i) => {
    const wrapper = wrappers[i];
    const actual = results[i * 2];
    const reference = results[i * 2 + 1];

    if (
      !wrapper ||
      actual?.status !== "success" ||
      reference?.status !== "success" ||
      typeof actual.result !== "bigint" ||
      typeof reference.result !== "bigint" ||
      actual.result === 0n ||
      reference.result === 0n
    ) {
      return {
        symbol: leg.symbol,
        wrapper: wrapper ?? ("0x" as Address),
        usdgIn: leg.usdgIn,
        unitsOut: null,
        impactBps: null,
      };
    }

    // Rates are units-out per USDG-in; scale to compare.
    const actualRate = (actual.result * 10n ** 18n) / leg.usdgIn;
    const refRate = (reference.result * 10n ** 18n) / REFERENCE_USDG;
    const impactBps =
      actualRate >= refRate ? 0 : Number(((refRate - actualRate) * 10_000n) / refRate);

    weightedImpact += impactBps * Number(leg.usdgIn);
    quotedNotional += leg.usdgIn;

    return {
      symbol: leg.symbol,
      wrapper,
      usdgIn: leg.usdgIn,
      unitsOut: actual.result,
      impactBps,
    };
  });

  return {
    legs: out,
    blendedBps: quotedNotional === 0n ? null : weightedImpact / Number(quotedNotional),
  };
}

/** Apply a slippage tolerance to a quoted amount. */
export function withSlippage(amount: bigint, toleranceBps: number): bigint {
  return (amount * BigInt(10_000 - toleranceBps)) / 10_000n;
}
