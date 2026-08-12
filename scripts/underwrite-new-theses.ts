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
    text: "The AI capital expenditure bill comes due, and the market stops pricing the spending as though it were already productive. Hyperscalers have committed enormous sums to buildout on the assumption that revenue follows on a schedule nobody has published. The firms that come out ahead are the ones with existing distribution to sell inference into, because they can monetise capacity against a customer base they already own rather than one they still have to win. Scale of budget is not the differentiator. Proximity to a paying customer is.",
  },
  {
    intendedTicker: "ATTENTION",
    text: "Generative models collapse the cost of producing content, and the scarce asset stops being supply and becomes distribution. When anyone can make an unlimited quantity of adequate material, the constraint moves to who can put it in front of people. Platforms that already own an audience capture the surplus, because they can fill more inventory at lower production cost without acquiring a single additional user. The value accrues to the pipe, not to what flows through it.",
  },
  {
    intendedTicker: "EDGEAI",
    text: "Inference migrates from the datacenter to the device. As models shrink and the silicon in consumer hardware improves, the economics favour running the work where the user already is, avoiding the round trip, the rental cost and the privacy exposure of sending everything to a server. Value shifts from cloud capacity toward the firms that control the device and the software layer sitting on it. The datacenter buildout does not stop, but the marginal query stops going there.",
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
