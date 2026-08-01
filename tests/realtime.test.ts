import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildRealtimeSessionPayload,
  createRealtimeCall,
  parseRealtimeCallId,
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
    expect(payload.instructions).toContain("Locked Operating Principles");
    expect(payload.instructions).toContain("Locked Interview Guide");
    expect(payload.instructions).toContain("Do not perform post-interview analysis");
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
});
