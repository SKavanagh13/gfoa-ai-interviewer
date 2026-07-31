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

export async function runSidebandController(
  input: SidebandControllerInput,
): Promise<void> {
  const env = getServerRuntimeEnv();
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
      ws.send(
        JSON.stringify({
          type: "response.create",
          response: {
            instructions:
              "Briefly thank the participant and close now because the 20-minute hard limit has been reached.",
          },
        }),
      );
      void hangUpRealtimeCall(input.callId).finally(() => ws.close());
    }, hardCapMs);

    ws.on("open", () => {
      clearTimeout(connectionTimer);
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
        void input.repository.markTechnicalFailure(input.interviewId, error.message);
        reject(error);
      }
    }
  });
}
