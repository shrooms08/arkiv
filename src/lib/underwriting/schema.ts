import { z } from "zod";
import {
  ALLOWED_SYMBOLS,
  MIN_CORE_BPS,
  MIN_PRIMARY_EXPRESSION_BPS,
} from "@/config/assets";

/**
 * The shape the underwriter must emit.
 *
 * Two layers enforce it, deliberately:
 *
 *  1. This Zod schema is handed to the API as a JSON Schema via
 *     `output_config.format`, so the model is CONSTRAINED to the shape rather
 *     than asked politely for it. Symbols are an enum drawn from the fixed
 *     allowlist, so the model cannot name an asset that does not exist.
 *  2. `constraints.ts` re-checks everything the schema cannot express —
 *     cross-field sums, the core floor, duplicates. Structured outputs
 *     guarantee shape, not arithmetic.
 *
 * Non-conforming output is rejected, never repaired. A basket that had to be
 * patched into legality is not the thesis the model actually proposed, and the
 * archive would be recording a fiction.
 */

export const HoldingSchema = z.object({
  // Zod v4 takes the readonly array directly. The model is constrained to the
  // allowlist by the schema itself, so it cannot name an asset that does not
  // exist — R2's address-only rule, enforced one layer earlier.
  symbol: z.enum(ALLOWED_SYMBOLS).describe("Ticker, from the allowlist only."),
  weightBps: z
    .number()
    .int()
    .min(500)
    .max(10000)
    .describe("Weight in basis points. Minimum 500. All weights sum to exactly 10000."),
  rationale: z
    .string()
    .min(40)
    .max(600)
    .describe(
      "Why THIS asset carries THIS thesis, at THIS weight. Specific to the holding, not a description of the company.",
    ),
});

export const FalsifierSchema = z.object({
  claim: z
    .string()
    .min(20)
    .max(400)
    .describe("The single load-bearing belief. If this is false, the thesis is wrong."),
  observable: z
    .string()
    .min(20)
    .max(300)
    .describe("The specific, checkable thing to watch. Must be observable without inside information."),
  breachCondition: z
    .string()
    .min(20)
    .max(300)
    .describe("The reading that falsifies the claim. Concrete enough that two people would agree it happened."),
  horizon: z
    .enum(["1M", "3M", "6M", "12M"])
    .describe("When the observable should have resolved."),
});

export const ThesisSchema = z.object({
  title: z.string().min(3).max(80).describe("Short, plain name for the thesis."),
  ticker: z
    .string()
    .regex(/^[A-Z][A-Z0-9]{2,9}$/)
    .describe("Basket share ticker: 3-10 chars, uppercase letters and digits, starting with a letter."),
  summary: z
    .string()
    .min(80)
    .max(800)
    .describe("What is believed and why, in plain language. No hedging, no disclaimers."),
  holdings: z.array(HoldingSchema).min(2).max(8),
  primaryExpression: z
    .enum(ALLOWED_SYMBOLS)
    .describe(
      "The one holding that most directly expresses this thesis. Must be one of the holdings, and must carry at least 1500 bps.",
    ),
  falsifier: FalsifierSchema,
  confidence: z
    .enum(["low", "medium", "high"])
    .describe("How strongly this is held. Honest 'low' is more useful than reflexive 'high'."),
});

export type Holding = z.infer<typeof HoldingSchema>;
export type Falsifier = z.infer<typeof FalsifierSchema>;
export type Thesis = z.infer<typeof ThesisSchema>;

/** Bounds restated for the prompt and the rubric, so they cannot drift apart. */
export const RULES = {
  minLegs: 2,
  maxLegs: 8,
  minLegBps: 500,
  totalBps: 10_000,
  minCoreBps: MIN_CORE_BPS,
  minPrimaryExpressionBps: MIN_PRIMARY_EXPRESSION_BPS,
} as const;
