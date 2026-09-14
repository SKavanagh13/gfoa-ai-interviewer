import type { AdminAnalysisRunSummary, AdminInterviewDetail } from "@/lib/admin/types";

export type AdminProcessingStatus = {
  headline: string;
  latestAnalysisRun: AdminAnalysisRunSummary | null;
  nextStep: string;
  tone: "attention" | "neutral" | "success";
};

type ProcessingStatusInput = Pick<
  AdminInterviewDetail,
  | "analysisEligibility"
  | "analysisRuns"
  | "browserConnectionStatus"
  | "lifecycleStatus"
  | "sidebandConnectionStatus"
  | "technicalError"
  | "transcriptProcessingError"
  | "transcriptStatus"
>;

export function summarizeAdminProcessingStatus(
  detail: ProcessingStatusInput,
): AdminProcessingStatus {
  const latestAnalysisRun = findLatestAnalysisRun(detail.analysisRuns);

  if (detail.technicalError) {
    return {
      headline: "Technical failure recorded",
      latestAnalysisRun,
      nextStep: "Review the technical error before queueing another analysis run.",
      tone: "attention",
    };
  }

  if (detail.transcriptStatus === "failed" || detail.transcriptProcessingError) {
    return {
      headline: "Transcript needs attention",
      latestAnalysisRun,
      nextStep: "Resolve transcript processing before this interview can be analyzed.",
      tone: "attention",
    };
  }

  if (isLiveOrEnding(detail.lifecycleStatus)) {
    return {
      headline: "Interview still in progress",
      latestAnalysisRun,
      nextStep: "Wait for browser and sideband connections to close and transcript stabilization to finish.",
      tone: "neutral",
    };
  }

  if (detail.transcriptStatus !== "stable") {
    return {
      headline: "Waiting for transcript stabilization",
      latestAnalysisRun,
      nextStep: "Wait for the transcript to become stable before analysis is queued.",
      tone: "neutral",
    };
  }

  if (detail.analysisEligibility === "ineligible_insufficient_content") {
    return {
      headline: "Not eligible for analysis",
      latestAnalysisRun,
      nextStep: "No analysis is expected unless the eligibility decision is rerun with sufficient transcript evidence.",
      tone: "neutral",
    };
  }

  if (!latestAnalysisRun) {
    return {
      headline: "Ready for analysis",
      latestAnalysisRun,
      nextStep: "Queue analysis or wait for the analysis worker to pick up the stable transcript.",
      tone: "neutral",
    };
  }

  if (latestAnalysisRun.status === "pending") {
    return {
      headline: "Analysis pending",
      latestAnalysisRun,
      nextStep: "Wait for the analysis worker to process the pending run.",
      tone: "neutral",
    };
  }

  if (latestAnalysisRun.status === "failed") {
    return {
      headline: "Analysis failed",
      latestAnalysisRun,
      nextStep: "Review the analysis error, then queue a rerun after fixing the cause.",
      tone: "attention",
    };
  }

  return {
    headline: "Ready for review",
    latestAnalysisRun,
    nextStep: "Review the selected analysis, objective evidence, quotes, and transcript segments.",
    tone: "success",
  };
}

function findLatestAnalysisRun(analysisRuns: AdminAnalysisRunSummary[]) {
  return (
    analysisRuns
      .slice()
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      )[0] ?? null
  );
}

function isLiveOrEnding(lifecycleStatus: string) {
  return lifecycleStatus === "active" || lifecycleStatus === "ending";
}
