import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.join(process.cwd(), "lib", "openai", "analysis.ts"),
  "utf8",
);

describe("Wave 5 OpenAI analysis contract", () => {
  it("uses Responses Structured Outputs with strict JSON schema and no tools", () => {
    expect(source).toContain("https://api.openai.com/v1/responses");
    expect(source).toContain('tools: []');
    expect(source).toContain('text: {');
    expect(source).toContain('type: "json_schema"');
    expect(source).toContain("strict: true");
  });

  it("uses the server-only analysis model instead of the Realtime model", () => {
    expect(source).toContain("env.OPENAI_ANALYSIS_MODEL");
    expect(source).not.toContain("OPENAI_REALTIME_MODEL");
  });

  it("handles output text, refusals, API errors, and token usage", () => {
    expect(source).toContain("extractOutputText");
    expect(source).toContain("extractRefusal");
    expect(source).toContain("extractApiError");
    expect(source).toContain("input_tokens");
    expect(source).toContain("output_tokens");
  });
});
