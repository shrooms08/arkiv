import { assetBySymbol } from "@/config/assets";
import { RULES, type Thesis } from "./schema";

/**
 * Every rule the JSON Schema cannot express. Structured outputs guarantee the
 * SHAPE of the response; these guarantee it is a legal basket.
 *
 * On failure the caller retries ONCE with these exact messages fed back, then
 * hard-fails. Nothing here repairs the output — a basket rewritten to be legal
 * is no longer the thesis the model proposed, and the archive exists to record
 * what was actually believed.
 *
 * The on-chain contract enforces a subset of this (see docs/RISKS.md R11): the
 * 5000 bps core FLOOR is a safety property and lives in `Arkiv.createBasket`,
 * while the 6000 bps CEILING is an expression band for the underwriter and is
 * enforced only here.
 */
export interface ConstraintViolation {
  rule: string;
  detail: string;
}

export function checkConstraints(thesis: Thesis): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];
  const { holdings } = thesis;

  if (holdings.length < RULES.minLegs || holdings.length > RULES.maxLegs) {
    violations.push({
      rule: "leg-count",
      detail: `A basket must hold between ${RULES.minLegs} and ${RULES.maxLegs} assets; this one holds ${holdings.length}.`,
    });
  }

  const seen = new Set<string>();
  for (const h of holdings) {
    if (seen.has(h.symbol)) {
      violations.push({ rule: "duplicate", detail: `${h.symbol} appears more than once.` });
    }
    seen.add(h.symbol);

    if (!assetBySymbol(h.symbol)) {
      violations.push({
        rule: "allowlist",
        detail: `${h.symbol} is not in the tradeable universe.`,
      });
    }

    if (h.weightBps < RULES.minLegBps) {
      violations.push({
        rule: "min-leg",
        detail: `${h.symbol} is ${h.weightBps} bps; the minimum is ${RULES.minLegBps} bps. Below that a leg costs more in gas and slippage than it contributes.`,
      });
    }
  }

  const sum = holdings.reduce((acc, h) => acc + h.weightBps, 0);
  if (sum !== RULES.totalBps) {
    violations.push({
      rule: "weight-sum",
      detail: `Weights sum to ${sum} bps; they must sum to exactly ${RULES.totalBps}. Adjust the weights, do not add or drop a holding unless the thesis genuinely changes.`,
    });
  }

  const coreBps = holdings
    .filter((h) => assetBySymbol(h.symbol)?.role === "core")
    .reduce((acc, h) => acc + h.weightBps, 0);

  if (coreBps < RULES.minCoreBps) {
    violations.push({
      rule: "core-floor",
      detail: `Core assets are ${coreBps} bps; the minimum is ${RULES.minCoreBps}. Core assets (GLDx, QQQx, SPYx, IWMx) sit in the deepest pools and keep mint slippage manageable.`,
    });
  }
  // There is no core ceiling. Expression is enforced directly instead, which is
  // what the ceiling was clumsily proxying for — and unlike a ceiling it does
  // not fight the floor when the deepest asset IS the thesis (a small-cap view
  // through IWMx).
  const primary = holdings.find((h) => h.symbol === thesis.primaryExpression);
  if (!primary) {
    violations.push({
      rule: "primary-expression-missing",
      detail: `primaryExpression is ${thesis.primaryExpression}, which is not one of the holdings. It must name a holding in this basket.`,
    });
  } else if (primary.weightBps < RULES.minPrimaryExpressionBps) {
    violations.push({
      rule: "primary-expression-weight",
      detail: `${primary.symbol} is named as the primary expression but carries only ${primary.weightBps} bps; the minimum is ${RULES.minPrimaryExpressionBps}. If the thesis is really expressed by this holding, weight it like it. If not, name the holding that does.`,
    });
  }

  return violations;
}

/** The retry message. Specific errors, not "try again". */
export function violationFeedback(violations: ConstraintViolation[]): string {
  const lines = violations.map((v) => `- [${v.rule}] ${v.detail}`).join("\n");
  return [
    "Your previous basket was rejected. It broke these rules:",
    "",
    lines,
    "",
    "Emit a corrected basket. Keep the thesis and the falsifier intact unless a rule",
    "genuinely forces the view to change — fix the weights, not the conviction.",
  ].join("\n");
}
