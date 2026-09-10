import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/interview/[interviewId]/realtime-call/route";
import { createAuthorizedParticipantRepository } from "@/lib/interview/route-auth";
import { dispatchSidebandWorker } from "@/lib/interview/sideband-dispatcher";
import { createRealtimeCall, hangUpRealtimeCall } from "@/lib/openai/realtime";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/interview/route-auth", () => ({
  createAuthorizedParticipantRepository: vi.fn(),
}));

vi.mock("@/lib/interview/sideband-dispatcher", () => ({
  dispatchSidebandWorker: vi.fn(async () => {}),
}));

vi.mock("@/lib/openai/realtime", () => ({
  createRealtimeCall: vi.fn(async () => ({
    sdpAnswer: "answer-sdp",
    callId: "rtc_abc",
  })),
  hangUpRealtimeCall: vi.fn(async () => {}),
  RealtimeCallCreationError: class RealtimeCallCreationError extends Error {},
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

describe("Realtime call route capacity guard", () => {
  beforeEach(() => {
    vi.mocked(createAuthorizedParticipantRepository).mockReset();
    vi.mocked(createRealtimeCall).mockClear();
    vi.mocked(hangUpRealtimeCall).mockClear();
    vi.mocked(dispatchSidebandWorker).mockClear();

    for (const [key, value] of Object.entries(env)) {
      vi.stubEnv(key, value);
    }
  });

  it("rejects a live session start when active interview capacity is reached", async () => {
    vi.stubEnv("MAX_ACTIVE_INTERVIEWS", "1");
    const repository = createRepository({ activeLiveInterviews: 1 });
    vi.mocked(createAuthorizedParticipantRepository).mockResolvedValue(
      repository as never,
    );

    const response = await POST(realtimeStartRequest(), {
      params: Promise.resolve({ interviewId: "interview-1" }),
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: "Live interview capacity reached",
      reason: "live_interview_capacity_reached",
      activeInterviewCount: 1,
      maxActiveInterviews: 1,
    });
    expect(repository.countActiveLiveInterviews).toHaveBeenCalled();
    expect(createRealtimeCall).not.toHaveBeenCalled();
    expect(dispatchSidebandWorker).not.toHaveBeenCalled();
    expect(repository.markTechnicalFailure).not.toHaveBeenCalled();
  });

  it("allows Realtime startup when the capacity guard is unset", async () => {
    vi.stubEnv("MAX_ACTIVE_INTERVIEWS", "");
    const repository = createRepository({ activeLiveInterviews: 99 });
    vi.mocked(createAuthorizedParticipantRepository).mockResolvedValue(
      repository as never,
    );

    const response = await POST(realtimeStartRequest(), {
      params: Promise.resolve({ interviewId: "interview-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ sdpAnswer: "answer-sdp" });
    expect(repository.countActiveLiveInterviews).not.toHaveBeenCalled();
    expect(createRealtimeCall).toHaveBeenCalled();
    expect(dispatchSidebandWorker).toHaveBeenCalledWith({
      interviewId: "interview-1",
      callId: "rtc_abc",
    });
  });
});

function realtimeStartRequest() {
  return new Request("http://localhost/api/interview/interview-1/realtime-call", {
    method: "POST",
    body: JSON.stringify({ sdpOffer: "offer-sdp" }),
  });
}

function createRepository(input: { activeLiveInterviews: number }) {
  return {
    getLiveInterviewContext: vi.fn(async () => ({
      interviewId: "interview-1",
      participantId: "participant-1",
      consentVersion: "consent-v1",
      consentedAt: new Date().toISOString(),
      realtimeCallId: null,
      participantContext: {
        governmentType: null,
        stateOrRegion: null,
        organizationSizeBand: null,
        experienceBand: null,
      },
    })),
    countActiveLiveInterviews: vi.fn(async () => input.activeLiveInterviews),
    persistRealtimeCallId: vi.fn(async () => {}),
    markTechnicalFailure: vi.fn(async () => {}),
  };
}
