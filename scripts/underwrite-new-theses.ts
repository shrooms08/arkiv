/**
 * Records the three new theses as fixtures.
 *
 * The paragraphs below are the author's, verbatim and unedited. They are not
 * reflowed, summarised or nudged toward something the model finds easier, which
 * is the whole point: the archive is meant to hold what someone actually wrote.
 *
 *   npx tsx scripts/underwrite-new-theses.ts
 */
import { config } from "dotenv";
import { formatUsd, sumCosts } from "../src/lib/underwriting/cost";
import { UnderwriteError, underwrite } from "../src/lib/underwriting/client";
import { appendLog, saveFixture } from "../src/lib/underwriting/store";

config();

interface Sample {
  /** The symbol the author intends this basket to ship under. */
  intendedTicker: string;
  text: string;
}

const SAMPLES: Sample[] = [
  {
    intendedTicker: "CAPEXPAY",
    text: "The AI capital expenditure bill comes due, and the market stops pricing the spending as though it were already productive. The distinction that matters is not who spent the most, it is who was already selling something to the customer they now want to sell inference to. Enterprise software vendors with an existing seat licence and an existing procurement relationship convert capacity into revenue without a new sales motion. Consumer platforms and infrastructure resellers have to build that relationship first, and they are paying for capacity in the meantime.",
  },
];

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set (put it in .env).");
    process.exit(1);
  }

  const allCosts = [];
  let failures = 0;

  for (const [i, sample] of SAMPLES.entries()) {
    const label = `${sample.intendedTicker}  (${i + 1}/${SAMPLES.length})`;
    console.log(`\n${"=".repeat(72)}\n${label}\n${"=".repeat(72)}`);

    try {
      const record = await underwrite(sample.text, {
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
      const tickerNote =
        t.ticker === sample.intendedTicker
          ? "matches intended"
          : `DIFFERS from intended ${sample.intendedTicker}`;

      console.log(`\n  ${t.title}  [${t.ticker}]  (${tickerNote})`);
      console.log(`  confidence=${t.confidence}  primary=${t.primaryExpression}`);
      console.log(`  ${t.summary.replace(/\s+/g, " ")}`);
      console.log();
      for (const h of t.holdings) {
        console.log(
          `  ${String(h.weightBps / 100).padStart(5)}%  ${h.symbol.padEnd(7)} ${h.rationale.replace(/\s+/g, " ")}`,
        );
      }
      console.log(`\n  FALSIFIER (${t.falsifier.horizon})`);
      console.log(`    claim:      ${t.falsifier.claim.replace(/\s+/g, " ")}`);
      console.log(`    observable: ${t.falsifier.observable.replace(/\s+/g, " ")}`);
      console.log(`    breach:     ${t.falsifier.breachCondition.replace(/\s+/g, " ")}`);
      console.log(`\n  attempts=${record.attempts}  hash=${record.thesisHash}  fixture=${path}`);
    } catch (error) {
      failures++;
      if (error instanceof UnderwriteError) {
        console.error(`  REJECTED after ${error.costs.length} call(s): ${error.message}`);
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
