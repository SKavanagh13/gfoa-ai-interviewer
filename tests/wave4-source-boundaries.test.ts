import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readWorkspaceFile(...segments: string[]) {
  return readFileSync(path.join(process.cwd(), ...segments), "utf8");
}

describe("Wave 4 canonical transcript boundaries", () => {
  it("requires canonical validation before marking transcripts stable", () => {
    const repository = readWorkspaceFile(
      "lib",
      "interview",
      "session-repository.ts",
    );

    expect(repository).toMatch(
      /markTranscriptStable[\s\S]*loadCanonicalTranscriptSegments[\s\S]*validateTranscriptForCanonicalUse/,
    );
    expect(repository).toMatch(
      /if \(!validation\.ok\)[\s\S]*markTranscriptFailed/,
    );
  });

  it("keeps quote matching on canonical segment text instead of serialized transcript text", () => {
    const quoteMatching = readWorkspaceFile(
      "lib",
      "transcript",
      "quote-matching.ts",
    );

    expect(quoteMatching).toContain("for (const segment of validation.orderedSegments)");
    expect(quoteMatching).toContain("buildNormalizedTextIndex(segment.text)");
    expect(quoteMatching).not.toContain("serializeTranscript");
  });

  it("does not introduce Wave 5 analysis execution or quote persistence", () => {
    const transcriptDirectory = readWorkspaceFile(
      "lib",
      "transcript",
      "quote-matching.ts",
    );
    const canonical = readWorkspaceFile("lib", "transcript", "canonical.ts");

    for (const source of [transcriptDirectory, canonical]) {
      expect(source).not.toContain("analysis_runs");
      expect(source).not.toContain("objective_results");
      expect(source).not.toContain("interview_quotes");
      expect(source).not.toContain("verification_status");
    }
  });
});
