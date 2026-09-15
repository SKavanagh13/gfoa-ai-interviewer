import { getServerRuntimeEnv } from "@/lib/server-runtime-env";
import { hangUpRealtimeCall } from "@/lib/openai/realtime";
import { InterviewSessionRepository } from "@/lib/interview/session-repository";
import { createServiceRoleSupabaseRuntimeClient } from "@/lib/supabase/service-role";

export type StaleInterviewFinalizationResult = {
  scanned: number;
  finalized: number;
  failed: number;
  results: Array<
    | {
        status: "finalized";
        interviewId: string;
      }
    | {
        status: "failed";
        interviewId: string;
        errorMessage: string;
      }
  >;
};

export type StaleInterviewFinalizerDependencies = {
  repository: Pick<
    InterviewSessionRepository,
    | "loadStaleLiveInterviews"
    | "markStaleLiveInterviewFinalized"
    | "markTranscriptStable"
  >;
  hangUpRealtimeCall: (callId: string) => Promise<void>;
  hardCapSeconds: number;
  reconciliationTimeoutMs: number;
  now: Date;
  limit?: number;
};

const DEFAULT_STALE_FINALIZATION_LIMIT = 20;

export async function finalizeStaleLiveInterviews(): Promise<StaleInterviewFinalizationResult> {
  const env = getServerRuntimeEnv();
  const repository = new InterviewSessionRepository(
    createServiceRoleSupabaseRuntimeClient(),
    env.PARTICIPANT_SESSION_TOKEN_SECRET,
    env.OPENAI_REALTIME_MODEL,
    { analysisModel: env.OPENAI_ANALYSIS_MODEL },
  );

  return finalizeStaleLiveInterviewsWithDependencies({
    repository,
    hangUpRealtimeCall,
    hardCapSeconds: Number(env.REALTIME_SESSION_HARD_CAP_SECONDS),
    reconciliationTimeoutMs: Number(env.TRANSCRIPT_RECONCILIATION_TIMEOUT_MS),
    now: new Date(),
  });
}

export async function finalizeStaleLiveInterviewsWithDependencies(
  dependencies: StaleInterviewFinalizerDependencies,
): Promise<StaleInterviewFinalizationResult> {
  const staleAfterMs =
    dependencies.hardCapSeconds * 1000 + dependencies.reconciliationTimeoutMs;
  const cutoffIso = new Date(
    dependencies.now.getTime() - staleAfterMs,
  ).toISOString();
  const interviews = await dependencies.repository.loadStaleLiveInterviews({
    cutoffIso,
    limit: dependencies.limit ?? DEFAULT_STALE_FINALIZATION_LIMIT,
  });
  const results: StaleInterviewFinalizationResult["results"] = [];

  for (const interview of interviews) {
    try {
      if (interview.realtimeCallId) {
        await dependencies
          .hangUpRealtimeCall(interview.realtimeCallId)
          .catch(() => undefined);
      }

      await dependencies.repository.markStaleLiveInterviewFinalized(
        interview.interviewId,
        "Live interview exceeded the hard cap without a clean sideband finalization signal.",
      );
      await dependencies.repository.markTranscriptStable(
        interview.interviewId,
        dependencies.reconciliationTimeoutMs,
      );
      results.push({
        status: "finalized",
        interviewId: interview.interviewId,
      });
    } catch (error) {
      results.push({
        status: "failed",
        interviewId: interview.interviewId,
        errorMessage:
          error instanceof Error
            ? error.message
            : "Failed to finalize stale live interview.",
      });
    }
  }

  return {
    scanned: interviews.length,
    finalized: results.filter((result) => result.status === "finalized").length,
    failed: results.filter((result) => result.status === "failed").length,
    results,
  };
}
