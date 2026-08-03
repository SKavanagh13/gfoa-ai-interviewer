import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildRealtimeSessionPayload,
  createRealtimeCall,
  parseRealtimeCallId,
  RealtimeCallCreationError,
} from "@/lib/openai/realtime";

vi.mock("server-only", () => ({}));

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

describe("OpenAI Realtime client", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", env.SUPABASE_SERVICE_ROLE_KEY);
    vi.stubEnv("OPENAI_API_KEY", env.OPENAI_API_KEY);
    vi.stubEnv("OPENAI_REALTIME_MODEL", env.OPENAI_REALTIME_MODEL);
    vi.stubEnv("OPENAI_ANALYSIS_MODEL", env.OPENAI_ANALYSIS_MODEL);
    vi.stubEnv(
      "REALTIME_SESSION_TARGET_SECONDS",
      env.REALTIME_SESSION_TARGET_SECONDS,
    );
    vi.stubEnv(
      "REALTIME_SESSION_HARD_CAP_SECONDS",
      env.REALTIME_SESSION_HARD_CAP_SECONDS,
    );
    vi.stubEnv(
      "SIDEBAND_CONNECTION_TIMEOUT_MS",
      env.SIDEBAND_CONNECTION_TIMEOUT_MS,
    );
    vi.stubEnv("SIDEBAND_DISPATCH_SECRET", env.SIDEBAND_DISPATCH_SECRET);
    vi.stubEnv(
      "PARTICIPANT_SESSION_TOKEN_SECRET",
      env.PARTICIPANT_SESSION_TOKEN_SECRET,
    );
    vi.stubEnv(
      "PARTICIPANT_SESSION_TOKEN_TTL_SECONDS",
      env.PARTICIPANT_SESSION_TOKEN_TTL_SECONDS,
    );
    vi.stubEnv("SIDEBAND_WORKER_BASE_URL", env.SIDEBAND_WORKER_BASE_URL);
    vi.stubEnv(
      "TRANSCRIPT_RECONCILIATION_TIMEOUT_MS",
      env.TRANSCRIPT_RECONCILIATION_TIMEOUT_MS,
    );
  });

  it("parses the call ID from the Location header", () => {
    expect(parseRealtimeCallId("/v1/realtime/calls/rtc_123")).toBe("rtc_123");
    expect(parseRealtimeCallId(null)).toBeNull();
  });

  it("builds a live prompt payload without tools or web access", () => {
    const payload = buildRealtimeSessionPayload({ sdpOffer: "v=0" });

    expect(payload.model).toBe("gpt-realtime");
    expect(payload.tool_choice).toBe("none");
    expect(payload.tools).toEqual([]);
    expect(payload.audio.input.turn_detection).toMatchObject({
      type: "semantic_vad",
      eagerness: "low",
      create_response: true,
      interrupt_response: false,
    });
    expect(payload.instructions).toContain("Locked Operating Principles");
    expect(payload.instructions).toContain("Locked Interview Guide");
    expect(payload.instructions).toContain("Initial opening script");
    expect(payload.instructions).toContain("Thanks for making the time to talk");
    expect(payload.instructions).toContain(
      "Read this opening exactly once, then ask the first question exactly as written",
    );
    expect(payload.instructions).toContain("Do not perform post-interview analysis");
    expect(payload.instructions).toContain("Ask at most one concise follow-up");
    expect(payload.instructions).toContain(
      "Where do you most often feel tension between what looks right on paper and what works in practice?",
    );
    expect(payload.instructions).toContain(
      "Brief per-objective acknowledgments or mini recaps are allowed",
    );
    expect(payload.instructions).toContain("Authorized MVP closing override");
    expect(payload.instructions).toContain(
      "Do not provide a broad final synthesis or recap of the whole interview",
    );
    expect(payload.instructions).toContain(
      "After the sixth objective, briefly recap only the participant's answer to that objective",
    );
    expect(payload.instructions).toContain(
      "Please select End interview to conclude our time together.",
    );
  });

  it("returns the SDP answer and never returns the permanent API key", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response("answer-sdp", {
        status: 201,
        headers: {
          Location: "/v1/realtime/calls/rtc_abc",
        },
      });
    });

    const result = await createRealtimeCall(
      { sdpOffer: "offer-sdp" },
      fetchMock as never,
    );

    expect(result).toEqual({
      sdpAnswer: "answer-sdp",
      callId: "rtc_abc",
    });
    expect(JSON.stringify(result)).not.toContain("openai-key");
  });

  it("sends Realtime WebRTC create-call fields as form strings", async () => {
    let submittedForm: FormData | undefined;
    const fetchMock = vi.fn(async (_url, init) => {
      submittedForm = init?.body instanceof FormData ? init.body : undefined;

      return new Response("answer-sdp", {
        status: 201,
        headers: {
          Location: "/v1/realtime/calls/rtc_abc",
        },
      });
    });

    await createRealtimeCall({ sdpOffer: "offer-sdp" }, fetchMock as never);

    if (!submittedForm) {
      throw new Error("Expected a FormData request body.");
    }

    const form = submittedForm;
    expect(form.get("sdp")).toBe("offer-sdp");
    expect(typeof form.get("session")).toBe("string");
    expect(form.get("sdp")).not.toBeInstanceOf(Blob);
    expect(form.get("session")).not.toBeInstanceOf(Blob);
  });

  it("preserves sanitized OpenAI error status and code for diagnostics", async () => {
    const fetchMock = vi.fn(async () => {
      return Response.json(
        {
          error: {
            message: "The model does not exist or you do not have access.",
            code: "model_not_found",
          },
        },
        { status: 403 },
      );
    });

    await expect(
      createRealtimeCall({ sdpOffer: "offer-sdp" }, fetchMock as never),
    ).rejects.toMatchObject({
      status: 403,
      apiCode: "model_not_found",
    } satisfies Partial<RealtimeCallCreationError>);

    await expect(
      createRealtimeCall({ sdpOffer: "offer-sdp" }, fetchMock as never),
    ).rejects.not.toThrow("openai-key");
  });
});
