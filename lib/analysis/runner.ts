import { getServerRuntimeEnv } from "@/lib/server-runtime-env";
import { createServiceRoleSupabaseRuntimeClient } from "@/lib/supabase/service-role";
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
import { estimateModelCostUsd } from "@/lib/cost-estimation";

export type RunPostInterviewAnalysisResult =
  | { status: "ineligible"; reason: string; participantWordCount: number }
  | { status: "failed"; analysisId?: string; errorMessage: string }
  | { status: "succeeded"; analysisId: string };

export type EnqueuePostInterviewAnalysisResult =
  | { status: "queued"; analysisId: string }
  | { status: "failed"; errorMessage: string };

export type DrainPendingAnalysisQueueResult = {
  processed: number;
  succeeded: number;
  failed: number;
  ineligible: number;
  results: RunPostInterviewAnalysisResult[];
};

export type PostInterviewAnalysisRunnerDependencies = {
  analysisModel: string;
  repository: Pick<
    AnalysisRepository,
    | "loadInterviewForAnalysis"
    | "loadCanonicalTranscriptSegments"
    | "recordEligibility"
    | "createPendingAnalysisRun"
    | "loadPendingAnalysisRun"
    | "loadPendingAnalysisRunForInterview"
    | "loadPendingAnalysisRuns"
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
  const env = getServerRuntimeEnv();
  return runPostInterviewAnalysisWithDependencies(interviewId, {
    analysisModel: env.OPENAI_ANALYSIS_MODEL,
    repository: new AnalysisRepository(createServiceRoleSupabaseRuntimeClient()),
    requestEligibilityClassification,
    requestPostInterviewAnalysis,
  });
}

export async function enqueuePostInterviewAnalysis(
  interviewId: string,
): Promise<EnqueuePostInterviewAnalysisResult> {
  const env = getServerRuntimeEnv();
  return enqueuePostInterviewAnalysisWithDependencies(interviewId, {
    analysisModel: env.OPENAI_ANALYSIS_MODEL,
    repository: new AnalysisRepository(createServiceRoleSupabaseRuntimeClient()),
    requestEligibilityClassification,
    requestPostInterviewAnalysis,
  });
}

export async function enqueuePostInterviewAnalysisWithDependencies(
  interviewId: string,
  dependencies: PostInterviewAnalysisRunnerDependencies,
): Promise<EnqueuePostInterviewAnalysisResult> {
  const interview =
    await dependencies.repository.loadInterviewForAnalysis(interviewId);

  if (!interview) {
    return { status: "failed", errorMessage: "Interview not found." };
  }

  if (interview.transcriptStatus !== "stable") {
    return {
      status: "failed",
      errorMessage: "Analysis cannot be queued until transcript status is stable.",
    };
  }

  const existing =
    await dependencies.repository.loadPendingAnalysisRunForInterview(
      interviewId,
    );

  if (existing) {
    return { status: "queued", analysisId: existing.analysisId };
  }

  const analysisId = await dependencies.repository.createPendingAnalysisRun({
    interviewId,
    analysisModel: dependencies.analysisModel,
  });

  return { status: "queued", analysisId };
}

export async function processPendingAnalysisRun(
  analysisId: string,
): Promise<RunPostInterviewAnalysisResult> {
  const env = getServerRuntimeEnv();
  return processPendingAnalysisRunWithDependencies(analysisId, {
    analysisModel: env.OPENAI_ANALYSIS_MODEL,
    repository: new AnalysisRepository(createServiceRoleSupabaseRuntimeClient()),
    requestEligibilityClassification,
    requestPostInterviewAnalysis,
  });
}

export async function processPendingAnalysisRunWithDependencies(
  analysisId: string,
  dependencies: PostInterviewAnalysisRunnerDependencies,
): Promise<RunPostInterviewAnalysisResult> {
  const run = await dependencies.repository.loadPendingAnalysisRun(analysisId);

  if (!run) {
    return {
      status: "failed",
      errorMessage: "Pending analysis run not found.",
    };
  }

  return executePostInterviewAnalysis(run.interviewId, {
    ...dependencies,
    analysisModel: run.analysisModel ?? dependencies.analysisModel,
  }, {
    queuedAnalysisId: run.analysisId,
  });
}

export async function drainPendingAnalysisQueue(input: {
  limit?: number;
} = {}): Promise<DrainPendingAnalysisQueueResult> {
  const env = getServerRuntimeEnv();
  const limit = input.limit ?? Number(env.ANALYSIS_WORKER_BATCH_SIZE);

  return drainPendingAnalysisQueueWithDependencies(
    { limit },
    {
      analysisModel: env.OPENAI_ANALYSIS_MODEL,
      repository: new AnalysisRepository(
        createServiceRoleSupabaseRuntimeClient(),
      ),
      requestEligibilityClassification,
      requestPostInterviewAnalysis,
    },
  );
}

export async function drainPendingAnalysisQueueWithDependencies(
  input: { limit: number },
  dependencies: PostInterviewAnalysisRunnerDependencies,
): Promise<DrainPendingAnalysisQueueResult> {
  const limit = clampBatchLimit(input.limit);
  const pendingRuns =
    await dependencies.repository.loadPendingAnalysisRuns(limit);
  const results: RunPostInterviewAnalysisResult[] = [];

  for (const run of pendingRuns) {
    results.push(
      await processPendingAnalysisRunWithDependencies(
        run.analysisId,
        dependencies,
      ),
    );
  }

  return summarizeQueueResults(results);
}

export async function runPostInterviewAnalysisWithDependencies(
  interviewId: string,
  dependencies: PostInterviewAnalysisRunnerDependencies,
): Promise<RunPostInterviewAnalysisResult> {
  return executePostInterviewAnalysis(interviewId, dependencies, {});
}

async function executePostInterviewAnalysis(
  interviewId: string,
  dependencies: PostInterviewAnalysisRunnerDependencies,
  options: { queuedAnalysisId?: string },
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

    const result = {
      status: "ineligible",
      reason: "Fewer than 40 finalized participant-spoken words.",
      participantWordCount: deterministicEligibility.participantWordCount,
    } as const;
    await markQueuedRunIneligible(repository, options.queuedAnalysisId, result.reason);
    return result;
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
    await markQueuedRunFailed(repository, options.queuedAnalysisId, {
      errorMessage: eligibilityResponse.errorMessage,
      rawStructuredOutput: eligibilityResponse.rawResponse,
      estimatedInputTokens: eligibilityResponse.usage.inputTokens,
      estimatedOutputTokens: eligibilityResponse.usage.outputTokens,
      estimatedAnalysisCostUsd: estimateModelCostUsd({
        model: dependencies.analysisModel,
        inputTokens: eligibilityResponse.usage.inputTokens,
        outputTokens: eligibilityResponse.usage.outputTokens,
      }),
    });
    return {
      status: "failed",
      analysisId: options.queuedAnalysisId,
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
    const result = {
      status: "ineligible",
      reason: eligibilityDecision.rationale,
      participantWordCount: eligibilityDecision.participantWordCount,
    } as const;
    await markQueuedRunIneligible(repository, options.queuedAnalysisId, result.reason);
    return result;
  }

  const analysisId =
    options.queuedAnalysisId ??
    await repository.createPendingAnalysisRun({
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
      estimatedAnalysisCostUsd: estimateModelCostUsd({
        model: dependencies.analysisModel,
        inputTokens: analysisResponse.usage.inputTokens,
        outputTokens: analysisResponse.usage.outputTokens,
      }),
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
      estimatedAnalysisCostUsd: estimateModelCostUsd({
        model: dependencies.analysisModel,
        inputTokens: analysisResponse.usage.inputTokens,
        outputTokens: analysisResponse.usage.outputTokens,
      }),
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
      estimatedAnalysisCostUsd: estimateModelCostUsd({
        model: dependencies.analysisModel,
        inputTokens: analysisResponse.usage.inputTokens,
        outputTokens: analysisResponse.usage.outputTokens,
      }),
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
      estimatedAnalysisCostUsd: estimateModelCostUsd({
        model: dependencies.analysisModel,
        inputTokens: analysisResponse.usage.inputTokens,
        outputTokens: analysisResponse.usage.outputTokens,
      }),
    });
    return { status: "failed", analysisId, errorMessage };
  }

  return { status: "succeeded", analysisId };
}

async function markQueuedRunIneligible(
  repository: PostInterviewAnalysisRunnerDependencies["repository"],
  analysisId: string | undefined,
  reason: string,
): Promise<void> {
  await markQueuedRunFailed(repository, analysisId, {
    errorMessage: `Interview is not eligible for analysis: ${reason}`,
  });
}

async function markQueuedRunFailed(
  repository: PostInterviewAnalysisRunnerDependencies["repository"],
  analysisId: string | undefined,
  values: Parameters<AnalysisRepository["markAnalysisRunFailed"]>[1],
): Promise<void> {
  if (!analysisId) {
    return;
  }

  await repository.markAnalysisRunFailed(analysisId, values);
}

function clampBatchLimit(limit: number): number {
  if (!Number.isInteger(limit) || limit < 1) {
    return 1;
  }

  return Math.min(limit, 50);
}

function summarizeQueueResults(
  results: RunPostInterviewAnalysisResult[],
): DrainPendingAnalysisQueueResult {
  return {
    processed: results.length,
    succeeded: results.filter((result) => result.status === "succeeded").length,
    failed: results.filter((result) => result.status === "failed").length,
    ineligible: results.filter((result) => result.status === "ineligible").length,
    results,
  };
}
