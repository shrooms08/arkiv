/**
 * Realistic demo props, transcribed from `test/fixtures/underwriting/*.json`.
 *
 * Every string here is real underwriter output at real length — the summaries
 * run 400+ characters and the rationales longer. Demos built on "Lorem ipsum"
 * or three-word labels hide exactly the failures that matter: truncation,
 * wrapping, and rows that collapse when a company name is long.
 *
 * Asset labels come from `src/config/assets.ts`.
 */

export interface DemoHolding {
  symbol: string;
  label: string;
  wrapper: string;
  weightBps: number;
  role: "core" | "satellite";
  rationale: string;
}

export interface DemoFalsifier {
  claim: string;
  observable: string;
  breachCondition: string;
  horizon: string;
}

export interface DemoThesis {
  index: number;
  thesisHash: string;
  title: string;
  ticker: string;
  summary: string;
  confidence: "low" | "medium" | "high";
  primaryExpression: string;
  holdings: DemoHolding[];
  falsifier: DemoFalsifier;
}

const LABELS: Record<string, string> = {
  GLDx: "Gold",
  QQQx: "Nasdaq 100",
  SPYx: "S&P 500",
  IWMx: "Russell 2000",
  NVDAx: "NVIDIA",
  TSLAx: "Tesla",
  MSFTx: "Microsoft",
  AMZNx: "Amazon",
  COINx: "Coinbase",
  METAx: "Meta Platforms",
  AVGOx: "Broadcom",
  GOOGLx: "Alphabet",
  AAPLx: "Apple",
  AMDx: "AMD",
};

const WRAPPERS: Record<string, string> = {
  GLDx: "0x8Ad9E4540f59A740eC9e7D44a73673F324401ade",
  QQQx: "0x513b881eD1f771aCb5decDaf536f2e9B2C080C34",
  SPYx: "0xfF49F7D98764e334d8507cC8284F63b306b98044",
  IWMx: "0xF62aF5F56ba0Eb1D8e92EBf18ECE2cA1a44f6958",
  NVDAx: "0x8C6498cf60C5268351C2694e3788E0e66F266995",
  AVGOx: "0x48917839eB39b4e603f7C28b559C533DA36A995e",
  AMZNx: "0x396EA001cf4a41b92037726617802AC1bD4a7F81",
};

function holding(
  symbol: string,
  weightBps: number,
  role: "core" | "satellite",
  rationale: string,
): DemoHolding {
  return {
    symbol,
    label: LABELS[symbol] ?? symbol,
    wrapper: WRAPPERS[symbol] ?? "0x0000000000000000000000000000000000000000",
    weightBps,
    role,
    rationale,
  };
}

/** SCRATE — fixture de82aadb08bef443. */
export const scrate: DemoThesis = {
  index: 3,
  thesisHash: "de82aadb08bef443",
  title: "Small Cap Rate Relief with Index Hedge",
  ticker: "SCRATE",
  confidence: "high",
  primaryExpression: "IWMx",
  summary:
    "Small caps have been disproportionately punished by high rates because they carry more floating-rate debt and have less access to locked-in fixed financing than megacaps. As the Fed eases, that liability burden lightens mechanically — not as sentiment, but as an interest expense line item.",
  holdings: [
    holding(
      "IWMx",
      5000,
      "core",
      "The Russell 2000 is the direct expression of the small-cap rate relief thesis. Small caps carry a higher proportion of floating-rate debt than large caps, so falling rates reduce interest expense mechanically and immediately.",
    ),
    holding(
      "SPYx",
      3000,
      "core",
      "Held as an explicit acknowledgment that the small-cap thesis may take longer to materialize than the 12-month horizon. This is a real hedge, not filler.",
    ),
    holding(
      "QQQx",
      2000,
      "core",
      "Nasdaq 100 exposure covers the scenario where AI-driven megacap earnings continue to surprise and dominate market returns.",
    ),
  ],
  falsifier: {
    claim:
      "Falling rates will cause small caps to outperform large caps over the next 12 months because rate relief mechanically reduces floating-rate interest expense, improving earnings for the Russell 2000 relative to the S&P 500.",
    observable:
      "Rolling 12-month total return of IWMx versus SPYx, measurable at any month-end with publicly available ETF data.",
    breachCondition:
      "IWMx total return trails SPYx total return by more than 5 percentage points over the 12-month window ending at horizon.",
    horizon: "12M",
  },
};

/** AIBOTTLE — fixture e4d242a38e509390. */
export const aibottle: DemoThesis = {
  index: 1,
  thesisHash: "e4d242a38e509390",
  title: "AI Infrastructure Bottleneck Capture",
  ticker: "AIBOTTLE",
  confidence: "high",
  primaryExpression: "NVDAx",
  summary:
    "Hyperscaler AI capex continues to compound because demand for inference and training exceeds supply of accelerators and networking silicon, and that shortfall shows up first in the companies selling the bottleneck rather than the ones buying it.",
  holdings: [
    holding("SPYx", 3000, "core", "Broad index exposure as the liquidity anchor of the basket."),
    holding(
      "NVDAx",
      2500,
      "satellite",
      "The most direct expression of the accelerator bottleneck. NVIDIA sells the constrained good and prices it accordingly.",
    ),
    holding("QQQx", 2500, "core", "Nasdaq 100 concentrates the buyers of AI infrastructure."),
    holding(
      "AVGOx",
      2000,
      "satellite",
      "Custom silicon and networking. Broadcom captures the switching and interconnect layer that scales with cluster size.",
    ),
  ],
  falsifier: {
    claim:
      "Accelerator and networking suppliers will outperform the broad index over 12 months because hyperscaler capex growth exceeds supply expansion.",
    observable:
      "Rolling 12-month total return of an equal-weight NVDAx/AVGOx pair versus SPYx, measured at month-end.",
    breachCondition:
      "The NVDAx/AVGOx pair trails SPYx by more than 8 percentage points over the 12-month window, or hyperscaler capex guidance is revised down two consecutive quarters.",
    horizon: "12M",
  },
};

/** STICKYINF — fixture 2563e23afaa8d654. */
export const stickyinf: DemoThesis = {
  index: 2,
  thesisHash: "2563e23afaa8d654",
  title: "Sticky Inflation, Central Bank Blink",
  ticker: "STICKYINF",
  confidence: "medium",
  primaryExpression: "GLDx",
  summary:
    "Inflation remains above target longer than consensus expects, and central banks cut rates before the job is finished because the political cost of a slowing labour market exceeds the political cost of tolerating 3% inflation.",
  holdings: [
    holding("GLDx", 3500, "core", "Gold is the direct expression of a central bank that blinks."),
    holding("SPYx", 2500, "core", "Index exposure; equities are not uniformly harmed by moderate inflation."),
    holding("QQQx", 1000, "core", "Long-duration growth, held small because it is rate-sensitive."),
    holding("IWMx", 1000, "core", "Small caps benefit from the same easing that produces the blink."),
    holding("AMZNx", 1000, "satellite", "Pricing power in consumer staples and logistics."),
    holding("AVGOx", 1000, "satellite", "Secular demand largely independent of the rate path."),
  ],
  falsifier: {
    claim:
      "Gold will outperform the S&P 500 over 12 months because real rates fall as central banks ease into above-target inflation.",
    observable:
      "Rolling 12-month total return of GLDx versus SPYx, measured at month-end alongside published headline CPI.",
    breachCondition:
      "Headline CPI prints below 2.5% for three consecutive months while GLDx trails SPYx by more than 5 percentage points.",
    horizon: "12M",
  },
};

export const demoTheses = [aibottle, stickyinf, scrate];

/** Segments for AllocationRibbon, derived from a thesis. */
export function segmentsFor(t: DemoThesis) {
  return t.holdings.map((h) => ({
    id: h.symbol,
    label: h.symbol,
    weightBps: h.weightBps,
    isPrimary: h.symbol === t.primaryExpression,
  }));
}

/**
 * A drifted second row for the two-row ribbon, so declared vs current is
 * visible. These are illustrative drift values, not measured holdings.
 */
export function driftedSegmentsFor(t: DemoThesis) {
  const drift = [1.14, 0.94, 0.92, 1.05, 0.97, 1.02];
  const raw = t.holdings.map((h, i) => h.weightBps * (drift[i] ?? 1));
  const total = raw.reduce((a, b) => a + b, 0);
  return t.holdings.map((h, i) => ({
    id: h.symbol,
    label: h.symbol,
    weightBps: Math.round((raw[i]! / total) * 10000),
    isPrimary: h.symbol === t.primaryExpression,
  }));
}
