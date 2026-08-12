/**
 * Generates the skill's reference files from the app's own source of truth.
 *
 * The allowlist and the constraint numbers are imported from the exact modules
 * the underwriter and the validator use, so the skill cannot describe a universe
 * the server will not accept. Hand-writing this file would guarantee drift the
 * first time an asset moves.
 *
 * The worked examples are read from the committed fixtures, quoting the author's
 * prose and the returned holdings verbatim rather than retyped, so the skill
 * teaches from records rather than from recollection.
 *
 *   npx tsx scripts/build-skill-reference.ts
 *
 * `npm test` regenerates and compares, so a change here that is not committed
 * fails the suite instead of silently rotting the documentation.
 */
import { cpSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { ASSETS, EXCLUDED, USDG } from "../src/config/assets";
import { RULES } from "../src/lib/underwriting/schema";

const SKILL_DIR = join(process.cwd(), "skills", "arkiv-thesis");
const OUT_DIR = join(SKILL_DIR, "reference");
/** Published copy, so the skill is reachable from the deployed site itself. */
const PUBLIC_DIR = join(process.cwd(), "public", "skills", "arkiv-thesis");
const FIXTURE_DIR = join(process.cwd(), "test", "fixtures", "underwriting");

/** Examples chosen to teach different things, not to flatter the underwriter. */
const EXAMPLE_TICKERS = ["CAPEXPAY", "SCRATE", "STICKYINF"];

const ROLE_LABEL: Record<string, string> = {
  core: "Liquidity anchor",
  tilt: "Thesis expression",
};

function allowlistDoc(): string {
  const core = ASSETS.filter((a) => a.role === "core");
  const tilt = ASSETS.filter((a) => a.role === "tilt");

  const row = (a: (typeof ASSETS)[number]) =>
    `| \`${a.symbol}\` | ${a.label} | ${ROLE_LABEL[a.role] ?? a.role} |`;

  return `# Asset allowlist

GENERATED FILE. Do not edit by hand. Produced by \`scripts/build-skill-reference.ts\`
from \`src/config/assets.ts\` and \`src/lib/underwriting/schema.ts\`, the same
modules the underwriter and the on-chain validator use.

A thesis can only be expressed in these ${ASSETS.length} assets. If the companies your
argument is really about are not here, the thesis is not expressible on Arkiv
today, and the honest outcome is to say so rather than to substitute a loosely
related name. The underwriter will not invent an asset, and neither should you.

Every asset is a Backed xStock wrapper, meaning a tokenized share of the
underlying US-listed security. Settlement is in ${USDG.symbol}.

## Liquidity anchors

Broad-exposure holdings. These are what the core floor is measured against:
at least **${RULES.minCoreBps} bps** of any basket must sit in this group.

| Symbol | Underlying | Role |
| --- | --- | --- |
${core.map(row).join("\n")}

## Thesis expressions

The names a thesis is actually about. One of these is normally the primary
expression, which must carry at least **${RULES.minPrimaryExpressionBps} bps**.

| Symbol | Underlying | Role |
| --- | --- | --- |
${tilt.map(row).join("\n")}

## Deliberately excluded

Verified as deployed on X Layer but not usable, because each lacks a ${USDG.symbol}
pool or has one too thin to price against. Excluded means excluded: a thesis
that needs one of these cannot be expressed, and no substitution is a fix.

${EXCLUDED.map((e) => `- \`${e.symbol}\`, ${e.reason}`).join("\n")}

## What the underwriter will enforce

| Rule | Value |
| --- | --- |
| Legs per basket | ${RULES.minLegs} to ${RULES.maxLegs} |
| Minimum per leg | ${RULES.minLegBps} bps |
| Weights must sum to | ${RULES.totalBps} bps |
| Core floor, liquidity anchors combined | at least ${RULES.minCoreBps} bps |
| Primary expression, single holding | at least ${RULES.minPrimaryExpressionBps} bps |

These are checked server-side after generation and rejected on failure. They are
not suggestions, and they are not something your prose can negotiate around. What
your prose can do is make them easy to satisfy, which is what the skill is for.

## What the universe cannot express

The ten thesis expressions above are all US large-cap technology, plus four
broad anchors. That is the whole surface a thesis has to work with.

There is no utilities, industrials, energy, defence, materials, real estate or
consumer-staples name anywhere, allowed or excluded. A thesis about the power
grid, reshoring or defence spending has nothing to buy at all.

Financials and healthcare exist only in the excluded list, meaning \`JPMx\`,
\`LLYx\` and \`UNHx\` are deployed but unusable. They are no more expressible
than a sector that was never listed, and the fact that a symbol exists is not
a reason to reach for it.

Recognising this before writing is faster than discovering it in a rejection.
Non-US exposure, small caps beyond \`IWMx\`, bonds, credit and currencies are
all likewise absent.
`;
}

interface Fixture {
  thesisHash: string;
  input: string;
  attempts: number;
  thesis: {
    ticker: string;
    title: string;
    summary: string;
    confidence: string;
    primaryExpression: string;
    holdings: { symbol: string; weightBps: number; rationale: string }[];
    falsifier: { claim: string; observable: string; breachCondition: string; horizon: string };
  };
}

function loadFixtures(): Fixture[] {
  return readdirSync(FIXTURE_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(FIXTURE_DIR, f), "utf8")) as Fixture);
}

function examplesDoc(): string {
  const all = loadFixtures();
  const picked = EXAMPLE_TICKERS.map((t) => {
    const hit = all.find((f) => f.thesis.ticker === t);
    if (!hit) throw new Error(`fixture for ${t} not found, cannot write examples from memory`);
    return hit;
  });

  const coreOf = (f: Fixture) =>
    f.thesis.holdings
      .filter((h) => ASSETS.find((a) => a.symbol === h.symbol)?.role === "core")
      .reduce((sum, h) => sum + h.weightBps, 0);

  const body = picked
    .map((f) => {
      const t = f.thesis;
      const primary = t.holdings.find((h) => h.symbol === t.primaryExpression);
      return `## ${t.ticker}

### What the author wrote

> ${f.input.trim().replace(/\n+/g, "\n> ")}

### What the underwriter returned

**${t.title}**, confidence ${t.confidence}, cleared in ${f.attempts} call${f.attempts === 1 ? "" : "s"}.

| Holding | Weight | Why it is that size |
| --- | --- | --- |
${t.holdings
  .map((h) => `| \`${h.symbol}\` | ${h.weightBps / 100}% | ${h.rationale.replace(/\s+/g, " ")} |`)
  .join("\n")}

Core lands at ${coreOf(f)} bps against a ${RULES.minCoreBps} bps floor. The primary expression is
\`${t.primaryExpression}\` at ${primary ? primary.weightBps : 0} bps against a ${RULES.minPrimaryExpressionBps} bps floor.

**Falsifier**, which the underwriter wrote and the author did not:

- Claim: ${t.falsifier.claim.replace(/\s+/g, " ")}
- Observable: ${t.falsifier.observable.replace(/\s+/g, " ")}
- Breach: ${t.falsifier.breachCondition.replace(/\s+/g, " ")}
- Horizon: ${t.falsifier.horizon}

Note what the author's paragraph did NOT contain: no tickers, no percentages, no
observable, no breach condition. It named a mechanism and a direction, and the
underwriter did the rest.
`;
    })
    .join("\n---\n\n");

  return `# Worked examples

GENERATED FILE. Do not edit by hand. Produced by \`scripts/build-skill-reference.ts\`
from the committed fixtures in \`test/fixtures/underwriting/\`. Every paragraph and
every holding below is quoted from a real record, not reconstructed.

${body}`;
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const files = [
    { name: "allowlist.md", body: allowlistDoc() },
    { name: "examples.md", body: examplesDoc() },
  ];
  for (const f of files) {
    writeFileSync(join(OUT_DIR, f.name), f.body);
    console.log(`  ${f.name.padEnd(14)} ${f.body.split("\n").length} lines`);
  }
  // Publish to public/ so the note on /app links to something that resolves,
  // rather than to a repository path that depends on what has been pushed.
  mkdirSync(PUBLIC_DIR, { recursive: true });
  cpSync(SKILL_DIR, PUBLIC_DIR, { recursive: true });
  console.log(`  published      public/skills/arkiv-thesis/`);
  console.log("skill reference generated");
}

/**
 * Only when run directly. The drift test imports `allowlistDoc` and
 * `examplesDoc` to compare against the committed files, and a bare `main()`
 * here would regenerate them on import, so the comparison would rewrite what it
 * was about to check and could never fail. It could not, until this guard.
 */
const invokedDirectly = process.argv[1]?.includes("build-skill-reference");
if (invokedDirectly) main();

export { allowlistDoc, examplesDoc };
