import "server-only";

import { getServerEnv } from "@/lib/env";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import {
  requestEligibilityClassification,
  requestPostInterviewAnalysis,
} from "@/lib/openai/analysis";
import {
  decideEligibilityFromClassifier,
  evaluateDeterministicEligibility,
} from "@/lib/analysis/eligibility";
import {
  buildSegmentMap,
  buildSerializedTranscript,
  AnalysisRepository,
} from "@/lib/analysis/repository";
import { validatePostInterviewOutput } from "@/lib/analysis/output-validation";
import { verifyQuoteProposals } from "@/lib/analysis/quote-verification";
import type { StructuredOutputModelResult } from "@/lib/analysis/types";

export type RunPostInterviewAnalysisResult =
  | { status: "ineligible"; reason: string; participantWordCount: number }
  | { status: "failed"; analysisId?: string; errorMessage: string }
  | { status: "succeeded"; analysisId: string };

export type PostInterviewAnalysisRunnerDependencies = {
  analysisModel: string;
  repository: Pick<
    AnalysisRepository,
    | "loadInterviewForAnalysis"
    | "loadCanonicalTranscriptSegments"
    | "recordEligibility"
    | "createPendingAnalysisRun"
    | "markAnalysisRunFailed"
    | "persistSucceededAnalysis"
  >;
  requestEligibilityClassification: (
    input: {
      serializedTranscript: string;
      segmentMap: string;
      participantContext: Record<string, string | null>;
    },
  ) => Promise<StructuredOutputModelResult>;
  requestPostInterviewAnalysis: (
    input: {
      serializedTranscript: string;
      segmentMap: string;
      participantContext: Record<string, string | null>;
    },
  ) => Promise<StructuredOutputModelResult>;
};

export async function runPostInterviewAnalysis(
  interviewId: string,
): Promise<RunPostInterviewAnalysisResult> {
  const env = getServerEnv();
  return runPostInterviewAnalysisWithDependencies(interviewId, {
    analysisModel: env.OPENAI_ANALYSIS_MODEL,
    repository: new AnalysisRepository(createServiceRoleSupabaseClient()),
    requestEligibilityClassification,
    requestPostInterviewAnalysis,
  });
}

export async function runPostInterviewAnalysisWithDependencies(
  interviewId: string,
  dependencies: PostInterviewAnalysisRunnerDependencies,
): Promise<RunPostInterviewAnalysisResult> {
  const repository = dependencies.repository;
  const interview = await repository.loadInterviewForAnalysis(interviewId);

  if (!interview) {
    return { status: "failed", errorMessage: "Interview not found." };
  }

  if (interview.transcriptStatus !== "stable") {
    return {
      status: "failed",
      errorMessage: "Analysis cannot begin until transcript status is stable.",
    };
  }

  const segments = await repository.loadCanonicalTranscriptSegments(interviewId);
  const deterministicEligibility = evaluateDeterministicEligibility(segments);

  if (deterministicEligibility.status === "word_count_failed") {
    await repository.recordEligibility({
      interviewId,
      eligibility: "ineligible_insufficient_content",
      supportingObjective: null,
      supportingSegmentIds: [],
    });

    return {
      status: "ineligible",
      reason: "Fewer than 40 finalized participant-spoken words.",
      participantWordCount: deterministicEligibility.participantWordCount,
    };
  }

  const serializedTranscript = buildSerializedTranscript(segments);
  const segmentMap = buildSegmentMap(segments);
  const modelInput = {
    serializedTranscript,
    segmentMap,
    participantContext: interview.participantContext,
  };

  const eligibilityResponse =
    await dependencies.requestEligibilityClassification(modelInput);

  if (eligibilityResponse.errorMessage) {
    return {
      status: "failed",
      errorMessage: eligibilityResponse.errorMessage,
    };
  }

  const eligibilityDecision = decideEligibilityFromClassifier(
    eligibilityResponse.parsed,
    segments,
    deterministicEligibility.participantWordCount,
  );

  await repository.recordEligibility({
    interviewId,
    eligibility: eligibilityDecision.eligible
      ? "eligible"
      : "ineligible_insufficient_content",
    supportingObjective: eligibilityDecision.supportingObjective,
    supportingSegmentIds: eligibilityDecision.supportingSegmentIds,
  });

  if (!eligibilityDecision.eligible) {
    return {
      status: "ineligible",
      reason: eligibilityDecision.rationale,
      participantWordCount: eligibilityDecision.participantWordCount,
    };
  }

  const analysisId = await repository.createPendingAnalysisRun({
    interviewId,
    analysisModel: dependencies.analysisModel,
  });

  const analysisResponse =
    await dependencies.requestPostInterviewAnalysis(modelInput);

  if (analysisResponse.errorMessage) {
    await repository.markAnalysisRunFailed(analysisId, {
      errorMessage: analysisResponse.errorMessage,
      rawStructuredOutput: analysisResponse.rawResponse,
      estimatedInputTokens: analysisResponse.usage.inputTokens,
      estimatedOutputTokens: analysisResponse.usage.outputTokens,
    });
    return {
      status: "failed",
      analysisId,
      errorMessage: analysisResponse.errorMessage,
    };
  }

  const validation = validatePostInterviewOutput(
    analysisResponse.parsed,
    segments,
  );

  if (!validation.ok) {
    await repository.markAnalysisRunFailed(analysisId, {
      errorMessage: validation.errorMessage,
      rawStructuredOutput: analysisResponse.rawResponse,
      estimatedInputTokens: analysisResponse.usage.inputTokens,
      estimatedOutputTokens: analysisResponse.usage.outputTokens,
    });
    return { status: "failed", analysisId, errorMessage: validation.errorMessage };
  }

  const verifiedQuotes = verifyQuoteProposals(
    validation.output.representative_quotes,
    segments,
  );

  try {
    await repository.persistSucceededAnalysis({
      analysisId,
      output: validation.output,
      rawStructuredOutput: analysisResponse.rawResponse,
      estimatedInputTokens: analysisResponse.usage.inputTokens,
      estimatedOutputTokens: analysisResponse.usage.outputTokens,
      verifiedQuotes,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to persist succeeded analysis.";
    await repository.markAnalysisRunFailed(analysisId, {
      errorMessage,
      rawStructuredOutput: analysisResponse.rawResponse,
      estimatedInputTokens: analysisResponse.usage.inputTokens,
      estimatedOutputTokens: analysisResponse.usage.outputTokens,
    });
    return { status: "failed", analysisId, errorMessage };
  }

  return { status: "succeeded", analysisId };
}
