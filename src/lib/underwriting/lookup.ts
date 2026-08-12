import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { UnderwriteRecord } from "./client";
import { loadFixtures } from "./store";

/**
 * Find a recorded thesis by hash. Fixtures first, then the append-only live log
 * — so a basket underwritten live in this session is viewable immediately
 * without having been promoted to a fixture.
 */
export function findRecord(hash: string): UnderwriteRecord | undefined {
  const fixture = loadFixtures().get(hash);
  if (fixture) return fixture;

  const logPath = join(process.cwd(), "logs", "underwriting.jsonl");
  if (!existsSync(logPath)) return undefined;

  // Last match wins: the most recent underwriting of this thesis.
  let found: UnderwriteRecord | undefined;
  for (const line of readFileSync(logPath, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const record = JSON.parse(line) as UnderwriteRecord;
    if (record.thesisHash === hash) found = record;
  }
  return found;
}

export function allRecords(): UnderwriteRecord[] {
  const byHash = new Map<string, UnderwriteRecord>();
  for (const [hash, record] of loadFixtures()) byHash.set(hash, record);

  // Fixtures win, matching findRecord. The log is append-only and keeps the
  // underwriter's original output, including the ticker it proposed before the
  // author settled on a different one. Letting it overwrite a fixture silently
  // reverted three baskets to the model's first guess locally, which detached
  // them from their cover art and their serial. Production never saw it only
  // because logs/ is excluded from the deploy, which is luck rather than design.
  const logPath = join(process.cwd(), "logs", "underwriting.jsonl");
  if (existsSync(logPath)) {
    for (const line of readFileSync(logPath, "utf8").split("\n")) {
      if (!line.trim()) continue;
      const record = JSON.parse(line) as UnderwriteRecord;
      if (!byHash.has(record.thesisHash)) byHash.set(record.thesisHash, record);
    }
  }
  return [...byHash.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
