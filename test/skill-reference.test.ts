import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { allowlistDoc, examplesDoc } from "../scripts/build-skill-reference";

const DIR = join(process.cwd(), "skills", "arkiv-thesis", "reference");

/**
 * The reference files are generated from `src/config/assets.ts`, the validator's
 * RULES, and the committed fixtures. Committing the output means it can rot, so
 * this regenerates and compares: moving an asset or changing a floor without
 * regenerating fails here rather than silently teaching agents a universe the
 * server will reject.
 */
describe("skill reference is generated, not hand-written", () => {
  it("allowlist.md matches its source of truth", () => {
    expect(readFileSync(join(DIR, "allowlist.md"), "utf8")).toBe(allowlistDoc());
  });

  it("examples.md matches the committed fixtures", () => {
    expect(readFileSync(join(DIR, "examples.md"), "utf8")).toBe(examplesDoc());
  });

  it("carries the generated-file warning so nobody edits it by hand", () => {
    for (const f of ["allowlist.md", "examples.md"]) {
      expect(readFileSync(join(DIR, f), "utf8")).toContain("GENERATED FILE");
    }
  });
});

describe("the skill stays inside its boundary", () => {
  const skill = readFileSync(join(process.cwd(), "skills", "arkiv-thesis", "SKILL.md"), "utf8");

  it("states plainly that it does not assign weights", () => {
    expect(skill).toMatch(/Assign weights/i);
    expect(skill).toMatch(/Write the falsifier/i);
    expect(skill).toMatch(/Produce JSON/i);
  });

  it("quotes the constraint values the validator actually enforces", () => {
    expect(skill).toContain("5000 bps");
    expect(skill).toContain("1500 bps");
    expect(skill).toContain("10000");
  });
});
