import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { selectAnalysisRun } from "@/lib/admin/repository";
import type { AdminAnalysisRunSummary } from "@/lib/admin/types";

function run(
  analysisId: string,
  status: AdminAnalysisRunSummary["status"],
  createdAt: string,
): AdminAnalysisRunSummary {
  return {
    analysisId,
    status,
    analysisModel: null,
    analysisPromptVersion: null,
    outputSpecificationVersion: null,
    structuredSchemaVersion: null,
    estimatedInputTokens: null,
    estimatedOutputTokens: null,
    estimatedAnalysisCostUsd: null,
    errorMessage: null,
    createdAt,
  };
}

describe("Wave 6 admin repository mapping", () => {
  it("selects the most recent succeeded analysis by default", () => {
    const runs = [
      run("failed-newest", "failed", "2026-08-01T12:00:00.000Z"),
      run("succeeded-newer", "succeeded", "2026-08-01T11:00:00.000Z"),
      run("succeeded-older", "succeeded", "2026-08-01T10:00:00.000Z"),
    ];

    expect(selectAnalysisRun(runs)?.analysisId).toBe("succeeded-newer");
  });

  it("falls back to the most recent run of any status", () => {
    const runs = [
      run("pending-newest", "pending", "2026-08-01T12:00:00.000Z"),
      run("failed-older", "failed", "2026-08-01T10:00:00.000Z"),
    ];

    expect(selectAnalysisRun(runs)?.analysisId).toBe("pending-newest");
  });

  it("honors an explicit selected analysis ID when present", () => {
    const runs = [
      run("newer", "succeeded", "2026-08-01T12:00:00.000Z"),
      run("requested", "failed", "2026-08-01T10:00:00.000Z"),
    ];

    expect(selectAnalysisRun(runs, "requested")?.analysisId).toBe("requested");
  });
});
