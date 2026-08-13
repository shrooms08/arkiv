import { describe, expect, it } from "vitest";

import { allRecords } from "../src/lib/underwriting/lookup";

import { ALLOWED_SYMBOLS, assetBySymbol } from "../src/config/assets";
import { checkConstraints } from "../src/lib/underwriting/constraints";
import { RULES, ThesisSchema, type Thesis } from "../src/lib/underwriting/schema";
import { costOf } from "../src/lib/underwriting/cost";
import { loadFixtures } from "../src/lib/underwriting/store";

/** A minimal legal basket: 50% core, 50% tilt. */
function baseThesis(overrides: Partial<Thesis> = {}): Thesis {
  return {
    title: "Test thesis",
    ticker: "TEST",
    summary: "x".repeat(100),
    holdings: [
      { symbol: "SPYx", weightBps: 5000, rationale: "y".repeat(50) },
      { symbol: "NVDAx", weightBps: 5000, rationale: "z".repeat(50) },
    ],
    primaryExpression: "NVDAx",
    falsifier: {
      claim: "c".repeat(30),
      observable: "o".repeat(30),
      breachCondition: "b".repeat(30),
      horizon: "6M",
    },
    confidence: "medium",
    ...overrides,
  };
}

describe("constraints", () => {
  it("accepts a legal basket", () => {
    expect(checkConstraints(baseThesis())).toEqual([]);
  });

  it("rejects weights that do not sum to 10000", () => {
    const v = checkConstraints(
      baseThesis({
        holdings: [
          { symbol: "SPYx", weightBps: 5000, rationale: "y".repeat(50) },
          { symbol: "NVDAx", weightBps: 4000, rationale: "z".repeat(50) },
        ],
      }),
    );
    expect(v.map((x) => x.rule)).toContain("weight-sum");
  });

  it("rejects a core allocation below the floor", () => {
    const v = checkConstraints(
      baseThesis({
        holdings: [
          { symbol: "SPYx", weightBps: 4000, rationale: "y".repeat(50) },
          { symbol: "NVDAx", weightBps: 3000, rationale: "z".repeat(50) },
          { symbol: "TSLAx", weightBps: 3000, rationale: "w".repeat(50) },
        ],
        primaryExpression: "NVDAx",
      }),
    );
    expect(v.map((x) => x.rule)).toContain("core-floor");
  });

  it("allows an index-heavy basket — there is deliberately no core ceiling", () => {
    // A 90% index basket is less risky, not more. The old ceiling was doing
    // product work under a risk label; expression is enforced separately.
    const v = checkConstraints(
      baseThesis({
        holdings: [
          { symbol: "SPYx", weightBps: 4000, rationale: "y".repeat(50) },
          { symbol: "QQQx", weightBps: 4000, rationale: "z".repeat(50) },
          { symbol: "NVDAx", weightBps: 2000, rationale: "w".repeat(50) },
        ],
        primaryExpression: "NVDAx",
      }),
    );
    expect(v).toEqual([]);
  });

  it("rejects a primaryExpression that is not a holding", () => {
    const v = checkConstraints(baseThesis({ primaryExpression: "TSLAx" }));
    expect(v.map((x) => x.rule)).toContain("primary-expression-missing");
  });

  it("rejects a primaryExpression carrying less than 1500 bps", () => {
    const v = checkConstraints(
      baseThesis({
        holdings: [
          { symbol: "SPYx", weightBps: 9000, rationale: "y".repeat(50) },
          { symbol: "NVDAx", weightBps: 1000, rationale: "z".repeat(50) },
        ],
        primaryExpression: "NVDAx",
      }),
    );
    expect(v.map((x) => x.rule)).toContain("primary-expression-weight");
  });

  it("lets one holding be both the liquidity anchor and the primary expression", () => {
    // The case that broke the old ceiling: a small-cap thesis through IWMx.
    const v = checkConstraints(
      baseThesis({
        holdings: [
          { symbol: "IWMx", weightBps: 3000, rationale: "y".repeat(50) },
          { symbol: "SPYx", weightBps: 2000, rationale: "z".repeat(50) },
          { symbol: "AMDx", weightBps: 3000, rationale: "w".repeat(50) },
          { symbol: "COINx", weightBps: 2000, rationale: "v".repeat(50) },
        ],
        primaryExpression: "IWMx",
      }),
    );
    expect(v).toEqual([]);
  });

  it("rejects duplicates", () => {
    const v = checkConstraints(
      baseThesis({
        holdings: [
          { symbol: "SPYx", weightBps: 5000, rationale: "y".repeat(50) },
          { symbol: "SPYx", weightBps: 5000, rationale: "z".repeat(50) },
        ],
      }),
    );
    expect(v.map((x) => x.rule)).toContain("duplicate");
  });

  it("rejects a leg below the minimum weight", () => {
    const v = checkConstraints(
      baseThesis({
        holdings: [
          { symbol: "SPYx", weightBps: 5600, rationale: "y".repeat(50) },
          { symbol: "NVDAx", weightBps: 4100, rationale: "z".repeat(50) },
          { symbol: "AMDx", weightBps: 300, rationale: "w".repeat(50) },
        ],
        primaryExpression: "NVDAx",
      }),
    );
    expect(v.map((x) => x.rule)).toContain("min-leg");
  });

  it("rejects more than eight legs", () => {
    const holdings = ALLOWED_SYMBOLS.slice(0, 9).map((symbol, i) => ({
      symbol,
      weightBps: i === 0 ? 10000 - 8 * 1000 + 1000 : 1000,
      rationale: "r".repeat(50),
    }));
    const v = checkConstraints(baseThesis({ holdings, primaryExpression: holdings[0]!.symbol }));
    expect(v.map((x) => x.rule)).toContain("leg-count");
  });
});

describe("schema", () => {
  it("refuses a symbol outside the allowlist", () => {
    const result = ThesisSchema.safeParse(
      baseThesis({
        holdings: [
          { symbol: "TSLA", weightBps: 5000, rationale: "y".repeat(50) },
          { symbol: "NVDAx", weightBps: 5000, rationale: "z".repeat(50) },
        ],
      } as unknown as Partial<Thesis>),
    );
    expect(result.success).toBe(false);
  });

  it("refuses an over-length summary", () => {
    const result = ThesisSchema.safeParse(baseThesis({ summary: "x".repeat(801) }));
    expect(result.success).toBe(false);
  });
});

describe("cost accounting", () => {
  it("prices sonnet-4-6 at list rates and counts cache tiers separately", () => {
    const c = costOf("claude-sonnet-4-6", {
      input_tokens: 1_000_000,
      output_tokens: 0,
      cache_read_input_tokens: 1_000_000,
      cache_creation_input_tokens: 0,
    });
    // 1M input at $3 + 1M cache-read at $0.30
    expect(c.usd).toBeCloseTo(3.3, 6);
  });

  it("flags an unpriced model rather than silently reporting $0 as real", () => {
    const c = costOf("some-future-model", { input_tokens: 100, output_tokens: 100 });
    expect(c.unpriced).toBe(true);
  });
});

describe("recorded fixtures", () => {
  const fixtures = [...loadFixtures().values()];

  it("has fixtures recorded", () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  it.each(fixtures.map((f) => [f.thesisHash, f] as const))(
    "%s is a legal, on-chain-mintable basket",
    (_hash, record) => {
      // Every recorded output must still satisfy the schema and the rules —
      // this is what catches a prompt change that quietly degrades output.
      expect(ThesisSchema.safeParse(record.thesis).success).toBe(true);
      expect(checkConstraints(record.thesis)).toEqual([]);

      const coreBps = record.thesis.holdings
        .filter((h) => assetBySymbol(h.symbol)?.role === "core")
        .reduce((a, h) => a + h.weightBps, 0);
      expect(coreBps).toBeGreaterThanOrEqual(RULES.minCoreBps);

      const primary = record.thesis.holdings.find(
        (h) => h.symbol === record.thesis.primaryExpression,
      );
      expect(primary).toBeDefined();
      expect(primary!.weightBps).toBeGreaterThanOrEqual(RULES.minPrimaryExpressionBps);

      // Provenance must be recorded, or the basket is not reproducible.
      expect(record.model).toBeTruthy();
      expect(record.promptVersion).toBeTruthy();
    },
  );

  it.each(fixtures.map((f) => [f.thesisHash, f] as const))(
    "%s has a falsifier with a concrete breach condition",
    (_hash, record) => {
      const { falsifier } = record.thesis;
      expect(falsifier.breachCondition.length).toBeGreaterThan(20);
      // A breach condition with no number, comparison or date is not checkable.
      expect(/\d|below|above|under|over|fewer|more than|flat|down/i.test(falsifier.breachCondition)).toBe(true);
    },
  );
});

describe("the reproducibility log cannot shadow a fixture", () => {
  it("every ticker allRecords returns matches its fixture", () => {
    // The log keeps the underwriter's original ticker, which for three baskets
    // is not the ticker they shipped under. If a log entry ever displaces a
    // fixture again, those baskets silently detach from their cover art and
    // their serial, which is what happened before this test existed.
    const fixtures = loadFixtures();
    for (const record of allRecords()) {
      const fixture = fixtures.get(record.thesisHash);
      if (!fixture) continue;
      expect(record.thesis.ticker).toBe(fixture.thesis.ticker);
    }
  });

  it("returns one record per hash", () => {
    const hashes = allRecords().map((r) => r.thesisHash);
    expect(new Set(hashes).size).toBe(hashes.length);
  });
});
