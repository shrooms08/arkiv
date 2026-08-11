/**
 * Token accounting. Credit on this account is limited, so spend is logged per
 * call rather than discovered on a bill.
 *
 * Rates are USD per million tokens, Anthropic first-party list price. Cache
 * reads bill at ~0.1x input and 5-minute cache writes at ~1.25x.
 */
export interface ModelRates {
  inputPerMTok: number;
  outputPerMTok: number;
}

const RATES: Record<string, ModelRates> = {
  "claude-sonnet-4-6": { inputPerMTok: 3.0, outputPerMTok: 15.0 },
  "claude-sonnet-5": { inputPerMTok: 3.0, outputPerMTok: 15.0 },
  "claude-haiku-4-5": { inputPerMTok: 1.0, outputPerMTok: 5.0 },
  "claude-opus-5": { inputPerMTok: 5.0, outputPerMTok: 25.0 },
  "claude-opus-4-8": { inputPerMTok: 5.0, outputPerMTok: 25.0 },
};

export interface UsageLike {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

export interface CallCost {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  usd: number;
  /** True when the model has no published rate here and `usd` is therefore 0. */
  unpriced: boolean;
}

export function costOf(model: string, usage: UsageLike): CallCost {
  const rates = RATES[model];
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;

  const usd = rates
    ? (usage.input_tokens * rates.inputPerMTok +
        cacheWrite * rates.inputPerMTok * 1.25 +
        cacheRead * rates.inputPerMTok * 0.1 +
        usage.output_tokens * rates.outputPerMTok) /
      1_000_000
    : 0;

  return {
    model,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheWriteTokens: cacheWrite,
    cacheReadTokens: cacheRead,
    usd,
    unpriced: !rates,
  };
}

export function formatUsd(usd: number): string {
  if (usd === 0) return "$0";
  if (usd < 0.01) return `$${usd.toFixed(5)}`;
  return `$${usd.toFixed(4)}`;
}

export function sumCosts(costs: CallCost[]): { usd: number; inputTokens: number; outputTokens: number } {
  return costs.reduce(
    (acc, c) => ({
      usd: acc.usd + c.usd,
      inputTokens: acc.inputTokens + c.inputTokens,
      outputTokens: acc.outputTokens + c.outputTokens,
    }),
    { usd: 0, inputTokens: 0, outputTokens: 0 },
  );
}
