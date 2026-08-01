import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hangUpRealtimeCall } from "@/lib/openai/realtime";
import {
  buildTimingConversationItem,
  runSidebandController,
  shouldSendNearLimitSignal,
} from "@/lib/interview/sideband-controller";
import { COMPLETED_INTERVIEW_CLOSING_SENTENCE } from "@/lib/interview/completion-signal";

vi.mock("@/lib/openai/realtime", () => ({
  hangUpRealtimeCall: vi.fn(async () => {}),
}));

const env = {
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  OPENAI_API_KEY: "openai-key",
  OPENAI_REALTIME_MODEL: "gpt-realtime",
  OPENAI_ANALYSIS_MODEL: "gpt-4o-mini",
  REALTIME_SESSION_TARGET_SECONDS: "900",
  REALTIME_SESSION_HARD_CAP_SECONDS: "1200",
  SIDEBAND_CONNECTION_TIMEOUT_MS: "10000",
  SIDEBAND_DISPATCH_SECRET: "sideband-dispatch-secret",
  PARTICIPANT_SESSION_TOKEN_SECRET: "participant-secret",
  PARTICIPANT_SESSION_TOKEN_TTL_SECONDS: "2700",
  SIDEBAND_WORKER_BASE_URL: "http://localhost:8787",
  TRANSCRIPT_RECONCILIATION_TIMEOUT_MS: "5000",
};

class FakeWebSocket {
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readyState = FakeWebSocket.OPEN;
  readonly sentMessages: string[] = [];
  private readonly handlers = new Map<string, Array<(...args: never[]) => void>>();

  constructor() {
    FakeWebSocket.instances.push(this);
  }

  on(eventName: string, handler: (...args: never[]) => void) {
    this.handlers.set(eventName, [
      ...(this.handlers.get(eventName) ?? []),
      handler,
    ]);
  }

  send(message: string) {
    this.sentMessages.push(message);
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
    this.emit("close");
  }

  emit(eventName: string, ...args: never[]) {
    for (const handler of this.handlers.get(eventName) ?? []) {
      handler(...args);
    }
  }
}

describe("sideband controller timing signals", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    FakeWebSocket.instances = [];
    vi.mocked(hangUpRealtimeCall).mockClear();

    for (const [key, value] of Object.entries(env)) {
      vi.stubEnv(key, value);
    }
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("builds a Realtime system item with elapsed and remaining timing state", () => {
    expect(
      buildTimingConversationItem({
        elapsedSeconds: 780,
        targetSeconds: 900,
        hardCapSeconds: 1200,
        kind: "near_limit",
      }),
    ).toEqual({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "system",
        content: [
          {
            type: "input_text",
            text: [
              "Application timing update for the live interview.",
              "Elapsed time: 780 seconds.",
              "Target duration: 900 seconds.",
              "Hard ceiling: 1200 seconds.",
              "Seconds until target: 120.",
              "Seconds until hard ceiling: 420.",
              "The interview is approaching the 15-minute target. Compress optional follow-ups, cover remaining objectives, and perform the approved time check-in before continuing.",
            ].join(" "),
          },
        ],
      },
    });
  });

  it("signals near-limit two minutes before the configured target", () => {
    expect(
      shouldSendNearLimitSignal({
        elapsedSeconds: 779,
        targetSeconds: 900,
      }),
    ).toBe(false);
    expect(
      shouldSendNearLimitSignal({
        elapsedSeconds: 780,
        targetSeconds: 900,
      }),
    ).toBe(true);
  });

  it("does not report negative remaining time after the hard ceiling", () => {
    const update = buildTimingConversationItem({
      elapsedSeconds: 1250,
      targetSeconds: 900,
      hardCapSeconds: 1200,
      kind: "hard_stop",
    });
    const text = update.item.content[0].text;

    expect(text).toContain("Seconds until target: 0.");
    expect(text).toContain("Seconds until hard ceiling: 0.");
    expect(text).toContain("Close immediately; do not continue the interview.");
  });

  it("sends timing system items through the sideband WebSocket", async () => {
    const repository = {
      markSidebandConnected: vi.fn(async () => {}),
      insertFinalTranscriptSegment: vi.fn(async () => {}),
      recordUsage: vi.fn(async () => {}),
      markTranscriptStable: vi.fn(async () => {}),
      markTranscriptFailed: vi.fn(async () => {}),
      markTechnicalFailure: vi.fn(async () => {}),
      hasContinuationConsent: vi.fn(async () => true),
    };
    const controllerPromise = runSidebandController({
      interviewId: "interview-1",
      callId: "rtc_123",
      repository: repository as never,
      WebSocketCtor: FakeWebSocket as never,
    });
    const ws = FakeWebSocket.instances[0];

    ws.emit("open");
    await vi.advanceTimersByTimeAsync(780_000);

    const sentUpdates = parseSentTimingItems(ws);

    expect(sentUpdates[0].item?.content?.[0]?.text).toContain(
      "Elapsed time: 0 seconds.",
    );
    expect(
      sentUpdates.some((message) =>
        message.item?.content?.[0]?.text?.includes(
          "Elapsed time: 60 seconds.",
        ),
      ),
    ).toBe(true);
    expect(
      sentUpdates.some((message) =>
        message.item?.content?.[0]?.text?.includes(
          "Elapsed time: 720 seconds.",
        ),
      ),
    ).toBe(true);
    expect(
      sentUpdates.some((message) =>
        message.item?.content?.[0]?.text?.includes(
          "The interview is approaching the 15-minute target.",
        ),
      ),
    ).toBe(true);

    ws.emit("message", JSON.stringify({ type: "session.ended" }) as never);
    ws.close();
    await controllerPromise;
    expect(repository.markTranscriptStable).toHaveBeenCalledWith(
      "interview-1",
      5000,
    );
  });

  it("marks completed from the finalized assistant closing signal", async () => {
    const repository = {
      markSidebandConnected: vi.fn(async () => {}),
      insertFinalTranscriptSegment: vi.fn(async () => {}),
      recordUsage: vi.fn(async () => {}),
      markTranscriptStable: vi.fn(async () => {}),
      markTranscriptFailed: vi.fn(async () => {}),
      markTechnicalFailure: vi.fn(async () => {}),
      markCompleted: vi.fn(async () => {}),
      hasContinuationConsent: vi.fn(async () => true),
    };
    const controllerPromise = runSidebandController({
      interviewId: "interview-1",
      callId: "rtc_123",
      repository: repository as never,
      WebSocketCtor: FakeWebSocket as never,
    });
    const ws = FakeWebSocket.instances[0];

    ws.emit("open");
    ws.emit(
      "message",
      JSON.stringify({
        type: "response.done",
        event_id: "evt_complete",
        response: {
          status: "completed",
          output: [
            {
              role: "assistant",
              content: [
                {
                  type: "output_audio",
                  transcript: `Before we wrap up, is there anything else GFOA should understand? ${COMPLETED_INTERVIEW_CLOSING_SENTENCE}`,
                },
              ],
            },
          ],
        },
      }) as never,
    );
    await controllerPromise;

    expect(repository.insertFinalTranscriptSegment).toHaveBeenCalledWith(
      "interview-1",
      expect.objectContaining({
        speaker: "interviewer",
        providerEventId: "evt_complete",
      }),
    );
    expect(repository.markCompleted).toHaveBeenCalledWith("interview-1");
    expect(hangUpRealtimeCall).toHaveBeenCalledWith("rtc_123");
    expect(repository.markTranscriptStable).toHaveBeenCalledWith(
      "interview-1",
      5000,
    );
    expect(repository.markTranscriptFailed).not.toHaveBeenCalled();
  });

  it("still hangs up when recording the completed disposition fails", async () => {
    const repository = {
      markSidebandConnected: vi.fn(async () => {}),
      insertFinalTranscriptSegment: vi.fn(async () => {}),
      recordUsage: vi.fn(async () => {}),
      markTranscriptStable: vi.fn(async () => {}),
      markTranscriptFailed: vi.fn(async () => {}),
      markTechnicalFailure: vi.fn(async () => {}),
      markCompleted: vi.fn(async () => {
        throw new Error("database unavailable");
      }),
      hasContinuationConsent: vi.fn(async () => true),
    };
    const controllerPromise = runSidebandController({
      interviewId: "interview-1",
      callId: "rtc_123",
      repository: repository as never,
      WebSocketCtor: FakeWebSocket as never,
    });
    const ws = FakeWebSocket.instances[0];

    ws.emit("open");
    ws.emit(
      "message",
      JSON.stringify({
        type: "response.done",
        event_id: "evt_complete",
        response: {
          status: "completed",
          output: [
            {
              role: "assistant",
              content: [
                {
                  type: "output_audio",
                  transcript: COMPLETED_INTERVIEW_CLOSING_SENTENCE,
                },
              ],
            },
          ],
        },
      }) as never,
    );
    await controllerPromise;

    expect(repository.markCompleted).toHaveBeenCalledWith("interview-1");
    expect(repository.markTechnicalFailure).toHaveBeenCalledWith(
      "interview-1",
      "database unavailable",
    );
    expect(hangUpRealtimeCall).toHaveBeenCalledWith("rtc_123");
    expect(repository.markTranscriptStable).toHaveBeenCalledWith(
      "interview-1",
      5000,
    );
  });

  it("enforces the hard cap through the sideband controller path", async () => {
    const repository = {
      markSidebandConnected: vi.fn(async () => {}),
      insertFinalTranscriptSegment: vi.fn(async () => {}),
      recordUsage: vi.fn(async () => {}),
      markTranscriptStable: vi.fn(async () => {}),
      markTranscriptFailed: vi.fn(async () => {}),
      markTechnicalFailure: vi.fn(async () => {}),
      hasContinuationConsent: vi.fn(async () => true),
    };
    const controllerPromise = runSidebandController({
      interviewId: "interview-1",
      callId: "rtc_123",
      repository: repository as never,
      WebSocketCtor: FakeWebSocket as never,
    });
    const ws = FakeWebSocket.instances[0];

    ws.emit("open");
    await vi.advanceTimersByTimeAsync(1_200_000);
    await controllerPromise;

    const sentTimingItems = parseSentTimingItems(ws);
    const sentResponseCreates = ws.sentMessages
      .map(
        (message) =>
          JSON.parse(message) as {
            type?: string;
            response?: { instructions?: string };
          },
      )
      .filter((message) => message.type === "response.create");

    expect(
      sentTimingItems.some((message) =>
        message.item?.content?.[0]?.text?.includes(
          "The 20-minute hard ceiling has been reached.",
        ),
      ),
    ).toBe(true);
    expect(sentResponseCreates).toHaveLength(1);
    expect(sentResponseCreates[0].response?.instructions).toContain(
      "20-minute hard limit",
    );
    expect(hangUpRealtimeCall).toHaveBeenCalledWith("rtc_123");
    expect(repository.markTranscriptStable).toHaveBeenCalledWith(
      "interview-1",
      5000,
    );
    expect(repository.markTranscriptFailed).not.toHaveBeenCalled();
  });

  it("closes at the 15-minute target when continuation consent is not recorded", async () => {
    const repository = {
      markSidebandConnected: vi.fn(async () => {}),
      insertFinalTranscriptSegment: vi.fn(async () => {}),
      recordUsage: vi.fn(async () => {}),
      markTranscriptStable: vi.fn(async () => {}),
      markTranscriptFailed: vi.fn(async () => {}),
      markTechnicalFailure: vi.fn(async () => {}),
      markParticipantEnded: vi.fn(async () => {}),
      hasContinuationConsent: vi.fn(async () => false),
    };
    const controllerPromise = runSidebandController({
      interviewId: "interview-1",
      callId: "rtc_123",
      repository: repository as never,
      WebSocketCtor: FakeWebSocket as never,
    });
    const ws = FakeWebSocket.instances[0];

    ws.emit("open");
    await vi.advanceTimersByTimeAsync(900_000);
    await controllerPromise;

    const sentTimingItems = parseSentTimingItems(ws);
    const sentResponseCreates = ws.sentMessages
      .map(
        (message) =>
          JSON.parse(message) as {
            type?: string;
            response?: { instructions?: string };
          },
      )
      .filter((message) => message.type === "response.create");

    expect(repository.hasContinuationConsent).toHaveBeenCalledWith(
      "interview-1",
    );
    expect(
      sentTimingItems.some((message) =>
        message.item?.content?.[0]?.text?.includes(
          "without recorded participant agreement",
        ),
      ),
    ).toBe(true);
    expect(sentResponseCreates).toHaveLength(1);
    expect(sentResponseCreates[0].response?.instructions).toContain(
      "has not agreed to continue",
    );
    expect(hangUpRealtimeCall).toHaveBeenCalledWith("rtc_123");
    expect(repository.markParticipantEnded).toHaveBeenCalledWith(
      "interview-1",
    );
    expect(repository.markTranscriptStable).toHaveBeenCalledWith(
      "interview-1",
      5000,
    );
    expect(repository.markTranscriptFailed).not.toHaveBeenCalled();
  });

  it("still hangs up when recording the target-close disposition fails", async () => {
    const repository = {
      markSidebandConnected: vi.fn(async () => {}),
      insertFinalTranscriptSegment: vi.fn(async () => {}),
      recordUsage: vi.fn(async () => {}),
      markTranscriptStable: vi.fn(async () => {}),
      markTranscriptFailed: vi.fn(async () => {}),
      markTechnicalFailure: vi.fn(async () => {}),
      markParticipantEnded: vi.fn(async () => {
        throw new Error("database unavailable");
      }),
      hasContinuationConsent: vi.fn(async () => false),
    };
    const controllerPromise = runSidebandController({
      interviewId: "interview-1",
      callId: "rtc_123",
      repository: repository as never,
      WebSocketCtor: FakeWebSocket as never,
    });
    const ws = FakeWebSocket.instances[0];

    ws.emit("open");
    await vi.advanceTimersByTimeAsync(900_000);
    await controllerPromise;

    expect(repository.markParticipantEnded).toHaveBeenCalledWith(
      "interview-1",
    );
    expect(repository.markTechnicalFailure).toHaveBeenCalledWith(
      "interview-1",
      "database unavailable",
    );
    expect(hangUpRealtimeCall).toHaveBeenCalledWith("rtc_123");
  });
});

function parseSentTimingItems(ws: FakeWebSocket) {
  return ws.sentMessages
    .map(
      (message) =>
        JSON.parse(message) as {
          type?: string;
          item?: { content?: Array<{ text?: string }> };
        },
    )
    .filter((message) => message.type === "conversation.item.create");
}
