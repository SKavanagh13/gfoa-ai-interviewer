import { describe, expect, it } from "vitest";
import { summarizeAdminProcessingStatus } from "@/lib/admin/processing-status";
import type { AdminAnalysisRunSummary, AdminInterviewDetail } from "@/lib/admin/types";

describe("Wave 6 admin processing status", () => {
  it("marks a stable interview with no analysis runs as ready for analysis", () => {
    expect(
      summarizeAdminProcessingStatus(detail({ analysisRuns: [] })),
    ).toMatchObject({
      headline: "Ready for analysis",
      nextStep:
        "Queue analysis or wait for the analysis worker to pick up the stable transcript.",
      tone: "neutral",
    });
  });

  it("surfaces the latest failed analysis run and its next step", () => {
    expect(
      summarizeAdminProcessingStatus(
        detail({
          analysisRuns: [
            run("older", "succeeded", "2026-09-13T10:00:00.000Z"),
            run("newer", "failed", "2026-09-13T11:00:00.000Z"),
          ],
        }),
      ),
    ).toMatchObject({
      headline: "Analysis failed",
      latestAnalysisRun: {
        analysisId: "newer",
        status: "failed",
      },
      tone: "attention",
    });
  });

  it("prefers transcript and technical failures before analysis status", () => {
    expect(
      summarizeAdminProcessingStatus(
        detail({
          analysisRuns: [run("pending", "pending", "2026-09-13T11:00:00.000Z")],
          transcriptProcessingError: "stabilization timeout",
          transcriptStatus: "failed",
        }),
      ).headline,
    ).toBe("Transcript needs attention");

    expect(
      summarizeAdminProcessingStatus(
        detail({
          technicalError: "sideband dispatch failed",
          transcriptProcessingError: "stabilization timeout",
          transcriptStatus: "failed",
        }),
      ).headline,
    ).toBe("Technical failure recorded");
  });

  it("marks succeeded analysis as ready for review", () => {
    expect(
      summarizeAdminProcessingStatus(
        detail({
          analysisRuns: [run("succeeded", "succeeded", "2026-09-13T11:00:00.000Z")],
        }),
      ),
    ).toMatchObject({
      headline: "Ready for review",
      tone: "success",
    });
  });
});

function detail(
  overrides: Partial<AdminInterviewDetail> = {},
): AdminInterviewDetail {
  return {
    analysisEligibility: "eligible",
    analysisEligibilitySupportingObjective: null,
    analysisRuns: [],
    audioStoragePath: null,
    browserConnectionStatus: "closed",
    consentVersion: null,
    consentedAt: null,
    continuationConsentedAt: null,
    costCategory: null,
    createdAt: "2026-09-13T00:00:00.000Z",
    durationSeconds: null,
    endDisposition: "participant_ended",
    endedAt: null,
    estimatedInputTokens: null,
    estimatedLiveCostUsd: null,
    estimatedOutputTokens: null,
    estimatedTotalCostUsd: null,
    interviewGuideVersion: null,
    interviewId: "interview-id",
    lifecycleStatus: "ended",
    livePromptVersion: null,
    negativeReactionFlag: null,
    operatingPrinciplesVersion: null,
    participantContext: null,
    participantId: "participant-id",
    selectedAnalysisRun: null,
    sidebandConnectionStatus: "closed",
    startedAt: null,
    technicalError: null,
    transcriptProcessingError: null,
    transcriptSegments: [],
    transcriptStatus: "stable",
    transcriptStoragePath: null,
    ...overrides,
  };
}

function run(
  analysisId: string,
  status: AdminAnalysisRunSummary["status"],
  createdAt: string,
): AdminAnalysisRunSummary {
  return {
    analysisId,
    analysisModel: "gpt-4o-mini",
    analysisPromptVersion: null,
    createdAt,
    errorMessage: status === "failed" ? "analysis failed" : null,
    estimatedAnalysisCostUsd: null,
    estimatedInputTokens: null,
    estimatedOutputTokens: null,
    outputSpecificationVersion: null,
    status,
    structuredSchemaVersion: null,
  };
}
