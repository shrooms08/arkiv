/**
 * Records real underwriting outputs as fixtures.
 *
 * This is the ONLY thing that should call the API during development. Everything
 * else — tests, the UI, the route in its default mode — reads the fixtures this
 * writes. Run it when the prompt or model changes, not on every iteration.
 *
 *   npx tsx scripts/underwrite-samples.ts
 */
import { config } from "dotenv";
import { formatUsd, sumCosts } from "../src/lib/underwriting/cost";
import { UnderwriteError, underwrite } from "../src/lib/underwriting/client";
import { appendLog, saveFixture } from "../src/lib/underwriting/store";

config();

/** Real theses, in the voice someone would actually type. */
const SAMPLES = [
  `AI infrastructure spending is going to keep compounding for at least another
   two years. The constraint isn't demand, it's power and packaging capacity, and
   the companies that own those bottlenecks capture the margin. I want exposure to
   that but I don't want to be wiped out if the capex cycle turns.`,

  `I think we're heading into a period where inflation stays stickier than the
   consensus expects and central banks blink before it's actually beaten. Real
   assets should do well and long-duration growth should struggle. I want to be
   defensive without sitting entirely in cash.`,

  `Everyone is obsessed with megacap tech but I think the interesting move over the
   next year is small caps catching a bid as rates come down. Big tech is priced
   for perfection. I still want some index exposure because I might be early, but
   I want the tilt to be real.`,
];

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set (put it in .env).");
    process.exit(1);
  }

  const allCosts = [];
  let failures = 0;

  for (const [i, thesis] of SAMPLES.entries()) {
    const label = `sample ${i + 1}/${SAMPLES.length}`;
    console.log(`\n${"=".repeat(72)}\n${label}\n${"=".repeat(72)}`);
    console.log(thesis.replace(/\s+/g, " ").trim());
    console.log();

    try {
      const record = await underwrite(thesis, {
        mode: "live",
        onUsage: (cost, attempt) => {
          allCosts.push(cost);
          console.log(
            `  [call ${attempt}] in=${cost.inputTokens} out=${cost.outputTokens} ` +
              `cache_read=${cost.cacheReadTokens} cache_write=${cost.cacheWriteTokens} ` +
              `cost=${formatUsd(cost.usd)}`,
          );
        },
      });

      appendLog(record);
      const path = saveFixture(record);

      const t = record.thesis;
      console.log(`\n  ${t.title}  [${t.ticker}]  confidence=${t.confidence}`);
      console.log(`  ${t.summary.replace(/\s+/g, " ")}`);
      console.log();
      for (const h of t.holdings) {
        console.log(`  ${String(h.weightBps / 100).padStart(5)}%  ${h.symbol.padEnd(7)} ${h.rationale.replace(/\s+/g, " ")}`);
      }
      console.log(`\n  FALSIFIER (${t.falsifier.horizon})`);
      console.log(`    claim:      ${t.falsifier.claim.replace(/\s+/g, " ")}`);
      console.log(`    observable: ${t.falsifier.observable.replace(/\s+/g, " ")}`);
      console.log(`    breach:     ${t.falsifier.breachCondition.replace(/\s+/g, " ")}`);
      console.log(`\n  attempts=${record.attempts}  hash=${record.thesisHash}  fixture=${path}`);
    } catch (error) {
      failures++;
      if (error instanceof UnderwriteError) {
        console.error(`  REJECTED: ${error.message}`);
        for (const v of error.violations) console.error(`    - [${v.rule}] ${v.detail}`);
        allCosts.push(...error.costs);
      } else {
        console.error("  FAILED:", error);
      }
    }
  }

  const total = sumCosts(allCosts);
  console.log(`\n${"=".repeat(72)}`);
  console.log(
    `TOTAL  calls=${allCosts.length}  in=${total.inputTokens}  out=${total.outputTokens}  spend=${formatUsd(total.usd)}`,
  );
  console.log(`${"=".repeat(72)}`);
  if (failures) process.exitCode = 1;
}

void main();
