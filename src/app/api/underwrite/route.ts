import { NextResponse } from "next/server";
import { z } from "zod";

import { UnderwriteError, resolveMode, underwrite } from "@/lib/underwriting/client";
import { appendLog, loadFixtures } from "@/lib/underwriting/store";
import { formatUsd } from "@/lib/underwriting/cost";

export const runtime = "nodejs";

const RequestSchema = z.object({
  thesis: z
    .string()
    .min(20, "A thesis needs at least a sentence.")
    .max(2000, "Keep the thesis under 2000 characters."),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", issues: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }

  const mode = resolveMode();

  try {
    const record = await underwrite(parsed.data.thesis, {
      mode,
      fixtures: mode === "fixtures" ? loadFixtures() : undefined,
      onUsage: (cost, attempt) => {
        console.log(
          `[underwrite] attempt=${attempt} model=${cost.model} in=${cost.inputTokens} out=${cost.outputTokens} ` +
            `cache_read=${cost.cacheReadTokens} cache_write=${cost.cacheWriteTokens} cost=${formatUsd(cost.usd)}`,
        );
      },
    });

    if (record.mode === "live") appendLog(record);

    return NextResponse.json({
      thesisHash: record.thesisHash,
      thesis: record.thesis,
      provenance: {
        model: record.model,
        promptVersion: record.promptVersion,
        effort: record.effort,
        mode: record.mode,
        attempts: record.attempts,
        createdAt: record.createdAt,
      },
      usage: {
        totalUsd: record.totalUsd,
        calls: record.costs,
      },
    });
  } catch (error) {
    if (error instanceof UnderwriteError) {
      // A rejected basket is a 422, not a 500: the request was well-formed, the
      // model's answer was not legal, and it was not repaired.
      return NextResponse.json(
        { error: error.message, violations: error.violations },
        { status: 422 },
      );
    }
    console.error("[underwrite] unexpected", error);
    return NextResponse.json({ error: "Underwriting failed." }, { status: 500 });
  }
}
