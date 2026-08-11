import { BaseError, ContractFunctionRevertedError } from "viem";

/**
 * Turns a contract revert into something a person can act on.
 *
 * Every rule in `Arkiv` and `Basket` reverts with a typed custom error carrying
 * the offending values. Surfacing the raw selector would waste that: the whole
 * point of `TokensNotAscending(a, b)` over a bare `require` is that it can be
 * explained. The UI sorts legs before submitting so most of these should be
 * unreachable — but "should be unreachable" is exactly when a raw hex string is
 * most useless to whoever hits it.
 */
export function explainRevert(error: unknown): string {
  if (error instanceof BaseError) {
    const revert = error.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName;
      const args = (revert.data?.args ?? []) as unknown[];
      const message = EXPLANATIONS[name ?? ""]?.(args);
      if (message) return message;
      if (name) return `${name}(${args.map(String).join(", ")})`;
    }
    if (error.shortMessage) return error.shortMessage;
  }
  return error instanceof Error ? error.message : String(error);
}

const EXPLANATIONS: Record<string, (args: unknown[]) => string> = {
  TokensNotAscending: () =>
    "Basket legs must be ordered by token address. This is a bug in the app, not something you did — please report it.",
  NotAllowed: (a) => `${a[0]} is not in the tradeable universe, so it cannot be a basket leg.`,
  CoreBelowMinimum: (a) =>
    `Liquidity anchors total ${Number(a[0]) / 100}%; at least 50% is required so the mint stays in deep pools.`,
  BadLegCount: (a) => `A basket must hold between 2 and 8 assets; this one has ${a[0]}.`,
  LegBelowMinimum: (a) =>
    `One leg is ${Number(a[1]) / 100}%, below the 5% minimum — under that it costs more in gas and slippage than it contributes.`,
  WeightsMustSumToBps: (a) => `Weights sum to ${a[0]} bps; they must sum to exactly 10000.`,
  AboveMintCap: (a) =>
    `That is above the current mint cap of $${(Number(a[1]) / 1e6).toLocaleString()}. The cap is linked to pool depth.`,
  BelowMinimumFirstMint: (a) =>
    `A basket's first mint must be at least $${(Number(a[1]) / 1e6).toLocaleString()}.`,
  InsufficientShares: (a) =>
    `You would receive ${(Number(a[0]) / 1e18).toFixed(4)} shares but asked for at least ${(Number(a[1]) / 1e18).toFixed(4)}. Raise your slippage tolerance or reduce the size.`,
  LegSlippage: (a) =>
    `Leg ${a[0]} delivered less than your floor. Raise your slippage tolerance or reduce the size.`,
  Sanctioned: (a) => `${a[0]} is on the deny-list Arkiv screens against.`,
  Paused: () => "Minting is paused. Redemption is never paused — you can still exit.",
  EmptyLeg: (a) => `Leg ${a[0]} received nothing from the swap; the pool may be empty.`,
  FaucetCooldown: () => "The faucet is rate-limited to once an hour. Try again shortly.",
};
