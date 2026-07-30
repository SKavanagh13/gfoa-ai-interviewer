import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const lockedDocs = [
  "01-ai-interviewer-operating-principles.md",
  "02-ai-interviewer-guide.md",
  "03-per-interview-output-specification.md",
  "04-ai-voice-interviewer-mvp-flow.md",
  "05-ai-voice-interviewer-mvp-technical-specification.md",
];

describe("locked project requirements", () => {
  it("keeps AGENTS.md at the repository root", () => {
    expect(existsSync(path.join(process.cwd(), "AGENTS.md"))).toBe(true);
  });

  it("keeps every locked requirement document in docs/locked", () => {
    for (const fileName of lockedDocs) {
      expect(existsSync(path.join(process.cwd(), "docs", "locked", fileName))).toBe(
        true,
      );
    }
  });

  it("keeps Wave 0 and Wave 1 implementation scope reviewable", () => {
    expect(
      existsSync(
        path.join(process.cwd(), "WAVES_0_1_IMPLEMENTATION_PLAN.md"),
      ),
    ).toBe(true);
  });

  it("commits the planned app/api folder for future route handlers", () => {
    expect(existsSync(path.join(process.cwd(), "app", "api", ".gitkeep"))).toBe(
      true,
    );
  });
});
