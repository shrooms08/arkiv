import { existsSync, mkdirSync, readFileSync, readdirSync, appendFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { UnderwriteRecord } from "./client";

const FIXTURE_DIR = join(process.cwd(), "test", "fixtures", "underwriting");
const LOG_PATH = join(process.cwd(), "logs", "underwriting.jsonl");

/**
 * Reproducibility log. Every live call appends one line: model, prompt version,
 * the exact input, the full output, usage and cost, keyed by thesisHash.
 *
 * Append-only on purpose. A basket that exists on-chain should be traceable to
 * the instructions and model version that produced it — and to nothing else,
 * because a later prompt revision would have produced a different basket.
 */
export function appendLog(record: UnderwriteRecord): void {
  mkdirSync(join(process.cwd(), "logs"), { recursive: true });
  appendFileSync(LOG_PATH, `${JSON.stringify(record)}\n`, "utf8");
}

/**
 * Cached sample outputs. The UI develops against these — repeated live calls
 * during frontend iteration are where API credit actually disappears.
 */
export function loadFixtures(): Map<string, UnderwriteRecord> {
  const map = new Map<string, UnderwriteRecord>();
  if (!existsSync(FIXTURE_DIR)) return map;

  for (const file of readdirSync(FIXTURE_DIR)) {
    if (!file.endsWith(".json")) continue;
    const record = JSON.parse(readFileSync(join(FIXTURE_DIR, file), "utf8")) as UnderwriteRecord;
    map.set(record.thesisHash, record);
  }
  return map;
}

export function saveFixture(record: UnderwriteRecord): string {
  mkdirSync(FIXTURE_DIR, { recursive: true });
  const path = join(FIXTURE_DIR, `${record.thesisHash}.json`);
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return path;
}
