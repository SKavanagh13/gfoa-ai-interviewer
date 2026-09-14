import type { AdminAnalysisRunSummary, AdminInterviewDetail } from "@/lib/admin/types";

export type AdminProcessingStatus = {
  headline: string;
  latestAnalysisRun: AdminAnalysisRunSummary | null;
  nextStep: string;
  tone: "attention" | "neutral" | "success";
  workerActivity: AdminWorkerActivity;
};

export type AdminWorkerActivity = {
  analysisRunCount: number;
  pendingRun: AdminAnalysisRunSummary | null;
  lastProcessedRun: AdminAnalysisRunSummary | null;
  latestSucceededRun: AdminAnalysisRunSummary | null;
  latestFailedRun: AdminAnalysisRunSummary | null;
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
  const workerActivity = summarizeAdminWorkerActivity(detail.analysisRuns);
  const latestAnalysisRun = findLatestAnalysisRun(detail.analysisRuns);

  if (detail.technicalError) {
    return {
      headline: "Technical failure recorded",
      latestAnalysisRun,
      nextStep: "Review the technical error before queueing another analysis run.",
      tone: "attention",
      workerActivity,
    };
  }

  if (detail.transcriptStatus === "failed" || detail.transcriptProcessingError) {
    return {
      headline: "Transcript needs attention",
      latestAnalysisRun,
      nextStep: "Resolve transcript processing before this interview can be analyzed.",
      tone: "attention",
      workerActivity,
    };
  }

  if (isLiveOrEnding(detail.lifecycleStatus)) {
    return {
      headline: "Interview still in progress",
      latestAnalysisRun,
      nextStep: "Wait for browser and sideband connections to close and transcript stabilization to finish.",
      tone: "neutral",
      workerActivity,
    };
  }

  if (detail.transcriptStatus !== "stable") {
    return {
      headline: "Waiting for transcript stabilization",
      latestAnalysisRun,
      nextStep: "Wait for the transcript to become stable before analysis is queued.",
      tone: "neutral",
      workerActivity,
    };
  }

  if (detail.analysisEligibility === "ineligible_insufficient_content") {
    return {
      headline: "Not eligible for analysis",
      latestAnalysisRun,
      nextStep: "No analysis is expected unless the eligibility decision is rerun with sufficient transcript evidence.",
      tone: "neutral",
      workerActivity,
    };
  }

  if (!latestAnalysisRun) {
    return {
      headline: "Ready for analysis",
      latestAnalysisRun,
      nextStep: "Queue analysis or wait for the analysis worker to pick up the stable transcript.",
      tone: "neutral",
      workerActivity,
    };
  }

  if (latestAnalysisRun.status === "pending") {
    return {
      headline: "Analysis pending",
      latestAnalysisRun,
      nextStep: "Wait for the analysis worker to process the pending run.",
      tone: "neutral",
      workerActivity,
    };
  }

  if (latestAnalysisRun.status === "failed") {
    return {
      headline: "Analysis failed",
      latestAnalysisRun,
      nextStep: "Review the analysis error, then queue a rerun after fixing the cause.",
      tone: "attention",
      workerActivity,
    };
  }

  return {
    headline: "Ready for review",
    latestAnalysisRun,
    nextStep: "Review the selected analysis, objective evidence, quotes, and transcript segments.",
    tone: "success",
    workerActivity,
  };
}

export function summarizeAdminWorkerActivity(
  analysisRuns: readonly AdminAnalysisRunSummary[],
): AdminWorkerActivity {
  const newestRuns = sortAnalysisRuns(analysisRuns);
  const processedRuns = newestRuns.filter((run) => run.status !== "pending");

  return {
    analysisRunCount: analysisRuns.length,
    pendingRun: newestRuns.find((run) => run.status === "pending") ?? null,
    lastProcessedRun: processedRuns[0] ?? null,
    latestSucceededRun:
      newestRuns.find((run) => run.status === "succeeded") ?? null,
    latestFailedRun: newestRuns.find((run) => run.status === "failed") ?? null,
  };
}

function findLatestAnalysisRun(analysisRuns: AdminAnalysisRunSummary[]) {
  return sortAnalysisRuns(analysisRuns)[0] ?? null;
}

function sortAnalysisRuns(
  analysisRuns: readonly AdminAnalysisRunSummary[],
): AdminAnalysisRunSummary[] {
  return analysisRuns
    .slice()
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
}

function isLiveOrEnding(lifecycleStatus: string) {
  return lifecycleStatus === "active" || lifecycleStatus === "ending";
}
