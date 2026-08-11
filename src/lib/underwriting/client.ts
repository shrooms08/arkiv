import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createHash } from "node:crypto";

import { checkConstraints, violationFeedback, type ConstraintViolation } from "./constraints";
import { costOf, formatUsd, sumCosts, type CallCost } from "./cost";
import { PROMPT_VERSION, SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import { ThesisSchema, type Thesis } from "./schema";

/**
 * Model is read from ANTHROPIC_MODEL and never hardcoded, so the model can be
 * swapped — for example if falsifier quality needs a stronger model for this one
 * call — without a code change.
 */
export const DEFAULT_MODEL = "claude-sonnet-4-6";

/**
 * Sized to the schema, not left at a large default. The longest legal response
 * is roughly 8 rationales at 600 chars plus an 800-char summary and the
 * falsifier — about 2,500 output tokens. The rest is headroom for thinking.
 */
const MAX_TOKENS = Number(process.env.ARKIV_UNDERWRITER_MAX_TOKENS ?? 6000);

/** Underwriting is a judgment call, but a bounded one. */
const EFFORT = (process.env.ARKIV_UNDERWRITER_EFFORT ?? "medium") as
  | "low"
  | "medium"
  | "high";

export type UnderwriteMode = "live" | "fixtures";

/**
 * Fixtures are the default everywhere except an explicit `live`. Frontend
 * iteration re-renders the same basket hundreds of times, and paying the API
 * for each of those is where credit actually disappears.
 */
export function resolveMode(): UnderwriteMode {
  return process.env.ARKIV_UNDERWRITER_MODE === "live" ? "live" : "fixtures";
}

/** Stable identity for a thesis: same text in, same key out. */
export function thesisHash(input: string): string {
  return createHash("sha256").update(input.trim()).digest("hex").slice(0, 16);
}

export interface UnderwriteRecord {
  thesisHash: string;
  input: string;
  model: string;
  promptVersion: string;
  effort: string;
  mode: UnderwriteMode;
  attempts: number;
  createdAt: string;
  thesis: Thesis;
  costs: CallCost[];
  totalUsd: number;
}

export class UnderwriteError extends Error {
  constructor(
    message: string,
    readonly violations: ConstraintViolation[],
    readonly costs: CallCost[],
  ) {
    super(message);
    this.name = "UnderwriteError";
  }
}

export interface UnderwriteOptions {
  /** Overrides the env-derived mode. Used by the sample script. */
  mode?: UnderwriteMode;
  /** Called once per API call with the cost of that call. */
  onUsage?: (cost: CallCost, attempt: number) => void;
  fixtures?: Map<string, UnderwriteRecord>;
}

export async function underwrite(
  input: string,
  opts: UnderwriteOptions = {},
): Promise<UnderwriteRecord> {
  const mode = opts.mode ?? resolveMode();
  const hash = thesisHash(input);

  if (mode === "fixtures") {
    const record = opts.fixtures?.get(hash);
    if (!record) {
      throw new UnderwriteError(
        `No fixture for thesis ${hash}. Run \`npm run underwrite:samples\` to record one, or set ARKIV_UNDERWRITER_MODE=live.`,
        [],
        [],
      );
    }
    return { ...record, mode: "fixtures" };
  }

  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  const client = new Anthropic();
  const costs: CallCost[] = [];

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: buildUserPrompt(input) },
  ];

  // One retry, with the specific violations fed back. Then hard fail — a
  // malformed basket is never silently repaired.
  for (let attempt = 1; attempt <= 2; attempt++) {
    // `create` + explicit parse, deliberately not `messages.parse`.
    //
    // Structured outputs constrain SHAPE but not string lengths — the SDK strips
    // minLength/maxLength from the JSON Schema and checks them client-side, and
    // `messages.parse` THROWS when that check fails. A too-long summary is a
    // normal, expected outcome that should cost one retry, not crash the route,
    // and the throw also happens before usage can be read, silently losing the
    // spend for that call.
    const response = await client.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      system: [
        // The system prompt is the stable prefix and is identical across every
        // request, so it caches; the thesis varies and sits after it.
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      output_config: { effort: EFFORT, format: zodOutputFormat(ThesisSchema) },
      messages,
    });

    const cost = costOf(model, response.usage);
    costs.push(cost);
    opts.onUsage?.(cost, attempt);

    if (response.stop_reason === "refusal") {
      throw new UnderwriteError("The model declined to underwrite this thesis.", [], costs);
    }
    if (response.stop_reason === "max_tokens") {
      throw new UnderwriteError(
        `Response hit max_tokens (${MAX_TOKENS}) before completing. Raise ARKIV_UNDERWRITER_MAX_TOKENS.`,
        [],
        costs,
      );
    }

    const text = response.content.find((b) => b.type === "text")?.text;
    if (!text) {
      throw new UnderwriteError("Model returned no text content.", [], costs);
    }

    let parsed: Thesis;
    let violations: ConstraintViolation[];

    const decoded = ThesisSchema.safeParse(JSON.parse(text));
    if (decoded.success) {
      parsed = decoded.data;
      violations = checkConstraints(parsed);
    } else {
      // Length and format failures are ordinary retry material, not crashes.
      parsed = JSON.parse(text) as Thesis;
      violations = decoded.error.issues.map((issue) => ({
        rule: `schema:${issue.path.join(".") || "root"}`,
        detail: issue.message,
      }));
    }
    if (violations.length === 0) {
      return {
        thesisHash: hash,
        input: input.trim(),
        model,
        promptVersion: PROMPT_VERSION,
        effort: EFFORT,
        mode: "live",
        attempts: attempt,
        createdAt: new Date().toISOString(),
        thesis: parsed,
        costs,
        totalUsd: sumCosts(costs).usd,
      };
    }

    if (attempt === 2) {
      throw new UnderwriteError(
        `Basket violated the composition rules twice; rejected. Total spend ${formatUsd(sumCosts(costs).usd)}.`,
        violations,
        costs,
      );
    }

    messages.push(
      { role: "assistant", content: JSON.stringify(parsed) },
      { role: "user", content: violationFeedback(violations) },
    );
  }

  /* c8 ignore next */
  throw new UnderwriteError("unreachable", [], costs);
}
