import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readWorkspaceFile(...segments: string[]) {
  return readFileSync(path.join(process.cwd(), ...segments), "utf8");
}

describe("analysis worker runtime boundaries", () => {
  it("keeps the standalone worker path free of Next server-only imports", () => {
    const worker = readWorkspaceFile("workers", "analysis-worker.ts");
    const runner = readWorkspaceFile("lib", "analysis", "runner.ts");
    const openaiAnalysis = readWorkspaceFile("lib", "openai", "analysis.ts");

    expect(worker).not.toContain("server-only");
    expect(runner).not.toContain("server-only");
    expect(openaiAnalysis).not.toContain("server-only");
    expect(runner).toContain("getServerRuntimeEnv");
    expect(openaiAnalysis).toContain("getServerRuntimeEnv");
  });
});
