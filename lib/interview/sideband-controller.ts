import WebSocket from "ws";
import { getServerRuntimeEnv } from "@/lib/server-runtime-env";
import { hangUpRealtimeCall } from "@/lib/openai/realtime";
import { parseSidebandEvent } from "@/lib/interview/sideband-events";
import type { InterviewSessionRepository } from "@/lib/interview/session-repository";

export type SidebandControllerInput = {
  interviewId: string;
  callId: string;
  repository: InterviewSessionRepository;
  WebSocketCtor?: typeof WebSocket;
};

export type TimingSignalKind =
  | "started"
  | "elapsed"
  | "near_limit"
  | "target_without_continuation_consent"
  | "hard_stop";

export type TimingSignalInput = {
  elapsedSeconds: number;
  targetSeconds: number;
  hardCapSeconds: number;
  kind: TimingSignalKind;
};

const TIMING_UPDATE_INTERVAL_MS = 60_000;
const NEAR_LIMIT_LEAD_SECONDS = 120;

export function buildTimingConversationItem(input: TimingSignalInput) {
  const remainingToTargetSeconds = Math.max(
    input.targetSeconds - input.elapsedSeconds,
    0,
  );
  const remainingToHardCapSeconds = Math.max(
    input.hardCapSeconds - input.elapsedSeconds,
    0,
  );

  return {
    type: "conversation.item.create",
    item: {
      type: "message",
      role: "system",
      content: [
        {
          type: "input_text",
          text: [
            "Application timing update for the live interview.",
            `Elapsed time: ${input.elapsedSeconds} seconds.`,
            `Target duration: ${input.targetSeconds} seconds.`,
            `Hard ceiling: ${input.hardCapSeconds} seconds.`,
            `Seconds until target: ${remainingToTargetSeconds}.`,
            `Seconds until hard ceiling: ${remainingToHardCapSeconds}.`,
            timingInstructionForKind(input.kind),
          ].join(" "),
        },
      ],
    },
  };
}

export function shouldSendNearLimitSignal(input: {
  elapsedSeconds: number;
  targetSeconds: number;
}): boolean {
  return input.elapsedSeconds >= Math.max(input.targetSeconds - NEAR_LIMIT_LEAD_SECONDS, 0);
}

export async function runSidebandController(
  input: SidebandControllerInput,
): Promise<void> {
  const env = getServerRuntimeEnv();
  const targetSeconds = Number(env.REALTIME_SESSION_TARGET_SECONDS);
  const hardCapSeconds = Number(env.REALTIME_SESSION_HARD_CAP_SECONDS);
  const targetMs = targetSeconds * 1000;
  const hardCapMs = Number(env.REALTIME_SESSION_HARD_CAP_SECONDS) * 1000;
  const connectionTimeoutMs = Number(env.SIDEBAND_CONNECTION_TIMEOUT_MS);
  const reconciliationTimeoutMs = Number(
    env.TRANSCRIPT_RECONCILIATION_TIMEOUT_MS,
  );
  const WebSocketImplementation = input.WebSocketCtor ?? WebSocket;
  const url = `wss://api.openai.com/v1/realtime?call_id=${encodeURIComponent(input.callId)}`;

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let sawEndSignal = false;
    let intentionalFinalization = false;
    let startedAtMs: number | null = null;
    let elapsedUpdateTimer: ReturnType<typeof setInterval> | null = null;
    let nearLimitTimer: ReturnType<typeof setTimeout> | null = null;
    let targetConsentTimer: ReturnType<typeof setTimeout> | null = null;
    const ws = new WebSocketImplementation(url, {
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
    });

    const connectionTimer = setTimeout(() => {
      rejectOnce(new Error("Sideband connection timed out"));
      ws.close();
    }, connectionTimeoutMs);

    const hardCapTimer = setTimeout(() => {
      intentionalFinalization = true;
      sendTimingSignal("hard_stop");
      sendResponseCreate(
        "Briefly thank the participant and close now because the 20-minute hard limit has been reached.",
      );
      void hangUpRealtimeCall(input.callId).finally(() => ws.close());
    }, hardCapMs);

    ws.on("open", () => {
      clearTimeout(connectionTimer);
      startedAtMs = Date.now();
      sendTimingSignal("started");
      elapsedUpdateTimer = setInterval(
        () => sendTimingSignal("elapsed"),
        TIMING_UPDATE_INTERVAL_MS,
      );
      nearLimitTimer = setTimeout(
        () => sendTimingSignal("near_limit"),
        Math.max(targetMs - NEAR_LIMIT_LEAD_SECONDS * 1000, 0),
      );
      targetConsentTimer = setTimeout(() => {
        void enforceTargetContinuationConsent().catch(rejectOnce);
      }, targetMs);
      void input.repository
        .markSidebandConnected(input.interviewId)
        .catch(rejectOnce);
    });

    ws.on("message", (message) => {
      let event: unknown;

      try {
        event = JSON.parse(message.toString());
      } catch {
        return;
      }

      void handleEvent(event).catch(rejectOnce);
    });

    ws.on("error", (error) => {
      rejectOnce(error);
    });

    ws.on("close", () => {
      clearTimeout(connectionTimer);
      clearTimeout(hardCapTimer);
      clearTimingTimers();
      void finalizeTranscript().then(resolveOnce).catch(rejectOnce);
    });

    async function handleEvent(event: unknown) {
      for (const parsed of parseSidebandEvent(event as never)) {
        if (parsed.kind === "transcript") {
          await input.repository.insertFinalTranscriptSegment(
            input.interviewId,
            parsed.segment,
          );
        } else if (parsed.kind === "usage") {
          await input.repository.recordUsage(input.interviewId, parsed);
        } else if (parsed.kind === "completedClosing") {
          await finalizeCompletedInterview();
        } else if (parsed.kind === "sessionEnded") {
          sawEndSignal = true;
        }
      }
    }

    async function finalizeTranscript() {
      if (sawEndSignal || intentionalFinalization) {
        await input.repository.markTranscriptStable(
          input.interviewId,
          reconciliationTimeoutMs,
        );
      } else {
        await input.repository.markTranscriptFailed(
          input.interviewId,
          reconciliationTimeoutMs,
          "Sideband closed before receiving a session-end signal.",
        );
      }
    }

    function sendTimingSignal(kind: TimingSignalKind) {
      if (ws.readyState !== WebSocket.OPEN) {
        return;
      }

      const elapsedSeconds =
        startedAtMs === null
          ? 0
          : Math.max(Math.floor((Date.now() - startedAtMs) / 1000), 0);

      ws.send(
        JSON.stringify(
          buildTimingConversationItem({
            elapsedSeconds,
            targetSeconds,
            hardCapSeconds,
            kind,
          }),
        ),
      );
    }

    function clearTimingTimers() {
      if (elapsedUpdateTimer) {
        clearInterval(elapsedUpdateTimer);
      }
      if (nearLimitTimer) {
        clearTimeout(nearLimitTimer);
      }
      if (targetConsentTimer) {
        clearTimeout(targetConsentTimer);
      }
    }

    async function enforceTargetContinuationConsent() {
      if (settled) {
        return;
      }

      const hasContinuationConsent =
        await input.repository.hasContinuationConsent(input.interviewId);

      if (hasContinuationConsent) {
        return;
      }

      intentionalFinalization = true;
      sendTimingSignal("target_without_continuation_consent");
      sendResponseCreate(
        "The 15-minute target has been reached and the participant has not agreed to continue. Briefly thank the participant and close now.",
      );
      try {
        await input.repository.markParticipantEnded(input.interviewId);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to record participant-ended disposition.";
        void input.repository
          .markTechnicalFailure(input.interviewId, message)
          .catch(() => undefined);
      } finally {
        void hangUpRealtimeCall(input.callId).finally(() => ws.close());
      }
    }

    async function finalizeCompletedInterview() {
      if (settled || intentionalFinalization) {
        return;
      }

      intentionalFinalization = true;

      try {
        await input.repository.markCompleted(input.interviewId);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to record completed disposition.";
        void input.repository
          .markTechnicalFailure(input.interviewId, message)
          .catch(() => undefined);
      } finally {
        void hangUpRealtimeCall(input.callId).finally(() => ws.close());
      }
    }

    function sendResponseCreate(instructions: string) {
      if (ws.readyState !== WebSocket.OPEN) {
        return;
      }

      ws.send(
        JSON.stringify({
          type: "response.create",
          response: {
            instructions,
          },
        }),
      );
    }

    function resolveOnce() {
      if (!settled) {
        settled = true;
        resolve();
      }
    }

    function rejectOnce(error: Error) {
      if (!settled) {
        settled = true;
        clearTimeout(connectionTimer);
        clearTimeout(hardCapTimer);
        clearTimingTimers();
        void input.repository.markTechnicalFailure(input.interviewId, error.message);
        reject(error);
      }
    }
  });
}

function timingInstructionForKind(kind: TimingSignalKind): string {
  if (kind === "near_limit") {
    return "The interview is approaching the 15-minute target. Compress optional follow-ups, cover remaining objectives, and perform the approved time check-in before continuing.";
  }

  if (kind === "hard_stop") {
    return "The 20-minute hard ceiling has been reached. Close immediately; do not continue the interview.";
  }

  if (kind === "target_without_continuation_consent") {
    return "The 15-minute target has been reached without recorded participant agreement to continue. Close now; do not continue the interview.";
  }

  if (kind === "started") {
    return "Use this timing state to pace the opening and the six locked objectives.";
  }

  return "Use this elapsed-time update to pace objective coverage and avoid unnecessary follow-ups.";
}
