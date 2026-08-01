import { describe, expect, it, vi } from "vitest";
import {
  runPostInterviewAnalysisWithDependencies,
  type PostInterviewAnalysisRunnerDependencies,
} from "@/lib/analysis/runner";
import { OBJECTIVES, OBJECTIVE_FIELD_NAMES } from "@/lib/analysis/constants";
import type { PostInterviewOutput } from "@/lib/analysis/types";
import type { CanonicalTranscriptSegment } from "@/lib/transcript/types";

vi.mock("server-only", () => ({}));

function participantSegment(text: string): CanonicalTranscriptSegment {
  return {
    segmentId: "segment-1",
    interviewId: "interview-1",
    sequenceNumber: 1,
    speaker: "participant",
    text,
    startTimeMs: 0,
    endTimeMs: 1000,
    providerEventId: "event-1",
    isFinal: true,
  };
}

function longParticipantText() {
  return [
    "The budget process changed quickly this year and it affected how departments understood tradeoffs.",
    "We had to explain why timing mattered, what constraints were real, and what support would help.",
    "The biggest issue was not one decision but the pressure to make practical choices with incomplete context.",
  ].join(" ");
}

function validOutput(): PostInterviewOutput {
  return {
    overview: {
      overall_summary:
        "The participant described budget timing pressure, recurring communication challenges, practical tradeoffs, recent change, support needs, and careful adoption.",
      primary_takeaway:
        "The most important thing to understand from this interview is that practical support must help explain tradeoffs.",
      notable_additional_issue: "None identified",
    },
    objective_results: OBJECTIVES.map((objective) => ({
      objective,
      narrative_summary: "Supported summary from the cited segment.",
      coverage: "partially_covered",
      confidence: "moderate",
      structured_fields: OBJECTIVE_FIELD_NAMES[objective].map((fieldName) => ({
        field_name: fieldName,
        value: null,
        value_status: "not_discussed",
      })),
      supporting_segment_ids: ["segment-1"],
    })),
    cross_cutting_themes: {
      key_tension: "No clear cross-cutting tension identified",
      recurring_concern: "No recurring concern identified",
      opportunity_signal: "No opportunity signal identified",
      emerging_signal: "No emerging signal identified",
    },
    topic_tags: [],
    representative_quotes: [
      {
        quote_text: "The budget process changed quickly this year",
        related_objective: "recent_change",
        reason_selected: "Shows the recent change.",
        proposed_segment_ids: ["segment-1"],
      },
    ],
    overall_quality: "adequate",
    limitations: null,
    negative_reaction_flag: null,
  };
}

function createDependencies(
  overrides: Partial<PostInterviewAnalysisRunnerDependencies> = {},
) {
  const calls = {
    recordEligibility: [] as Array<{
      eligibility: string;
      supportingObjective: string | null;
    }>,
    createPendingAnalysisRun: [] as Array<{
      interviewId: string;
      analysisModel: string;
    }>,
    markAnalysisRunFailed: [] as Array<{
      analysisId: string;
      errorMessage: string;
      estimatedAnalysisCostUsd: number | null | undefined;
    }>,
    persistSucceededAnalysis: [] as Array<{
      analysisId: string;
      estimatedAnalysisCostUsd: number | null;
    }>,
    eligibilityRequests: 0,
    analysisRequests: 0,
  };
  let runCount = 0;

  const dependencies: PostInterviewAnalysisRunnerDependencies = {
    analysisModel: "gpt-4o-mini",
    repository: {
      async loadInterviewForAnalysis() {
        return {
          interviewId: "interview-1",
          transcriptStatus: "stable",
          participantContext: {
            government_type: null,
            state_or_region: null,
            organization_size_band: null,
            experience_band: null,
          },
        };
      },
      async loadCanonicalTranscriptSegments() {
        return [participantSegment(longParticipantText())];
      },
      async recordEligibility(decision) {
        calls.recordEligibility.push({
          eligibility: decision.eligibility,
          supportingObjective: decision.supportingObjective,
        });
      },
      async createPendingAnalysisRun(input) {
        calls.createPendingAnalysisRun.push(input);
        runCount += 1;
        return `analysis-${runCount}`;
      },
      async markAnalysisRunFailed(analysisId, values) {
        calls.markAnalysisRunFailed.push({
          analysisId,
          errorMessage: values.errorMessage,
          estimatedAnalysisCostUsd: values.estimatedAnalysisCostUsd,
        });
      },
      async persistSucceededAnalysis(input) {
        calls.persistSucceededAnalysis.push({
          analysisId: input.analysisId,
          estimatedAnalysisCostUsd: input.estimatedAnalysisCostUsd,
        });
      },
    },
    async requestEligibilityClassification() {
      calls.eligibilityRequests += 1;
      return {
        parsed: {
          eligible: true,
          supporting_objective: "current_issue",
          supporting_segment_ids: ["segment-1"],
          rationale: "The participant explains a central point and why it matters.",
        },
        rawResponse: {},
        usage: { inputTokens: null, outputTokens: null },
        refusal: null,
        errorMessage: null,
      };
    },
    async requestPostInterviewAnalysis() {
      calls.analysisRequests += 1;
      return {
        parsed: validOutput(),
        rawResponse: {},
        usage: { inputTokens: null, outputTokens: null },
        refusal: null,
        errorMessage: null,
      };
    },
    ...overrides,
  };

  return { calls, dependencies };
}

describe("Wave 5 analysis runner", () => {
  it("does not begin analysis for unstable transcripts", async () => {
    const { calls, dependencies } = createDependencies({
      repository: {
        ...createDependencies().dependencies.repository,
        async loadInterviewForAnalysis() {
          return {
            interviewId: "interview-1",
            transcriptStatus: "stabilizing",
            participantContext: {},
          };
        },
      },
    });

    await expect(
      runPostInterviewAnalysisWithDependencies("interview-1", dependencies),
    ).resolves.toMatchObject({ status: "failed" });
    expect(calls.eligibilityRequests).toBe(0);
    expect(calls.createPendingAnalysisRun).toHaveLength(0);
  });

  it("records ineligible and does not create a run below 40 participant words", async () => {
    const base = createDependencies();
    const dependencies: PostInterviewAnalysisRunnerDependencies = {
      ...base.dependencies,
      repository: {
        ...base.dependencies.repository,
        async loadCanonicalTranscriptSegments() {
          return [participantSegment("too short")];
        },
      },
    };

    const result = await runPostInterviewAnalysisWithDependencies(
      "interview-1",
      dependencies,
    );

    expect(result).toMatchObject({ status: "ineligible" });
    expect(base.calls.recordEligibility).toHaveLength(1);
    expect(base.calls.createPendingAnalysisRun).toHaveLength(0);
  });

  it("does not mark an interview ineligible when the classifier request fails", async () => {
    const base = createDependencies({
      async requestEligibilityClassification() {
        return {
          parsed: null,
          rawResponse: { error: { message: "rate limited" } },
          usage: { inputTokens: null, outputTokens: null },
          refusal: null,
          errorMessage: "rate limited",
        };
      },
    });

    const result = await runPostInterviewAnalysisWithDependencies(
      "interview-1",
      base.dependencies,
    );

    expect(result).toEqual({
      status: "failed",
      errorMessage: "rate limited",
    });
    expect(base.calls.recordEligibility).toHaveLength(0);
    expect(base.calls.createPendingAnalysisRun).toHaveLength(0);
  });

  it("creates a pending analysis run only after eligible stable transcripts", async () => {
    const base = createDependencies();

    await expect(
      runPostInterviewAnalysisWithDependencies("interview-1", base.dependencies),
    ).resolves.toMatchObject({ status: "succeeded", analysisId: "analysis-1" });

    expect(base.calls.recordEligibility).toHaveLength(1);
    expect(base.calls.createPendingAnalysisRun).toEqual([
      { interviewId: "interview-1", analysisModel: "gpt-4o-mini" },
    ]);
    expect(base.calls.persistSucceededAnalysis).toHaveLength(1);
  });

  it("persists analysis estimated cost from response usage", async () => {
    const base = createDependencies({
      async requestPostInterviewAnalysis() {
        return {
          parsed: validOutput(),
          rawResponse: {},
          usage: { inputTokens: 1_000_000, outputTokens: 500_000 },
          refusal: null,
          errorMessage: null,
        };
      },
    });

    await expect(
      runPostInterviewAnalysisWithDependencies("interview-1", base.dependencies),
    ).resolves.toMatchObject({ status: "succeeded" });

    expect(base.calls.persistSucceededAnalysis[0]).toMatchObject({
      analysisId: "analysis-1",
      estimatedAnalysisCostUsd: 0.45,
    });
  });

  it("records failed analysis estimated cost when a model error includes usage", async () => {
    const base = createDependencies({
      async requestPostInterviewAnalysis() {
        return {
          parsed: null,
          rawResponse: { error: { message: "bad output" } },
          usage: { inputTokens: 1_000_000, outputTokens: 500_000 },
          refusal: null,
          errorMessage: "bad output",
        };
      },
    });

    await expect(
      runPostInterviewAnalysisWithDependencies("interview-1", base.dependencies),
    ).resolves.toMatchObject({ status: "failed" });

    expect(base.calls.markAnalysisRunFailed[0]).toMatchObject({
      analysisId: "analysis-1",
      errorMessage: "bad output",
      estimatedAnalysisCostUsd: 0.45,
    });
  });

  it("reruns create new analysis runs without reusing the prior analysis ID", async () => {
    const base = createDependencies();

    await runPostInterviewAnalysisWithDependencies(
      "interview-1",
      base.dependencies,
    );
    await runPostInterviewAnalysisWithDependencies(
      "interview-1",
      base.dependencies,
    );

    expect(base.calls.createPendingAnalysisRun).toHaveLength(2);
    expect(base.calls.persistSucceededAnalysis.map((call) => call.analysisId)).toEqual([
      "analysis-1",
      "analysis-2",
    ]);
  });
});
