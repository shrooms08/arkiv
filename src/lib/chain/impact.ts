import { ASSETS, assetBySymbol } from "@/config/assets";

/**
 * Expected price impact for a mint, interpolated from the measurements in
 * `assets.ts` — which were taken by executing real swaps against the real pools
 * on a mainnet fork, not modelled.
 *
 * This is an ESTIMATE shown before the user commits, so they can see which leg is
 * expensive. It is not what protects the mint: `minAmountsOut` and `minSharesOut`
 * do that, and they are enforced on-chain against measured balance deltas.
 */
export interface LegImpact {
  symbol: string;
  usdgIn: bigint;
  bps: number;
}

/** Linear interpolation between the $1k / $5k / $10k measured points. */
export function impactBpsFor(symbol: string, usdgBaseUnits: bigint): number {
  const asset = assetBySymbol(symbol);
  if (!asset) return 0;
  const usd = Number(usdgBaseUnits) / 1e6;
  const { at1k, at5k, at10k } = asset.impactBps;

  if (usd <= 1000) return (at1k * usd) / 1000;
  if (usd <= 5000) return at1k + ((at5k - at1k) * (usd - 1000)) / 4000;
  if (usd <= 10000) return at5k + ((at10k - at5k) * (usd - 5000)) / 5000;
  // Beyond the measured range, extrapolate from the last segment and be clear
  // in the UI that it is out of range.
  return at10k + ((at10k - at5k) * (usd - 10000)) / 5000;
}

export function legImpacts(
  holdings: { symbol: string; weightBps: number }[],
  usdgIn: bigint,
): { legs: LegImpact[]; blendedBps: number } {
  let assigned = 0n;
  const legs: LegImpact[] = holdings.map((h, i) => {
    const amount =
      i === holdings.length - 1
        ? usdgIn - assigned
        : (usdgIn * BigInt(h.weightBps)) / 10_000n;
    assigned += amount;
    return { symbol: h.symbol, usdgIn: amount, bps: impactBpsFor(h.symbol, amount) };
  });

  const weighted = legs.reduce((acc, l) => acc + l.bps * Number(l.usdgIn), 0);
  const blendedBps = usdgIn === 0n ? 0 : weighted / Number(usdgIn);
  return { legs, blendedBps };
}

/** The USDG split, matching what the contract expects. */
export function splitFor(
  holdings: { weightBps: number }[],
  usdgIn: bigint,
): bigint[] {
  let assigned = 0n;
  return holdings.map((h, i) => {
    if (i === holdings.length - 1) return usdgIn - assigned;
    const amount = (usdgIn * BigInt(h.weightBps)) / 10_000n;
    assigned += amount;
    return amount;
  });
}

export const ALL_SYMBOLS = ASSETS.map((a) => a.symbol);
