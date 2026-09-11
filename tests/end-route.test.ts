import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/interview/[interviewId]/end/route";
import { createAuthorizedParticipantRepository } from "@/lib/interview/route-auth";
import { hangUpRealtimeCall } from "@/lib/openai/realtime";

vi.mock("@/lib/interview/route-auth", () => ({
  createAuthorizedParticipantRepository: vi.fn(),
}));

vi.mock("@/lib/openai/realtime", () => ({
  hangUpRealtimeCall: vi.fn(async () => {}),
}));

describe("participant end route", () => {
  beforeEach(() => {
    vi.mocked(createAuthorizedParticipantRepository).mockReset();
    vi.mocked(hangUpRealtimeCall).mockReset();
  });

  it("returns 401 without an authorized participant session", async () => {
    vi.mocked(createAuthorizedParticipantRepository).mockResolvedValue(null);

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ interviewId: "interview-1" }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("marks the participant-ended lifecycle even when Realtime hangup fails", async () => {
    const repository = {
      getLiveInterviewContext: vi.fn(async () => ({
        realtimeCallId: "rtc_123",
      })),
      markParticipantEnded: vi.fn(async () => {}),
    };
    vi.mocked(createAuthorizedParticipantRepository).mockResolvedValue(
      repository as never,
    );
    vi.mocked(hangUpRealtimeCall).mockRejectedValue(new Error("not found"));

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ interviewId: "interview-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(hangUpRealtimeCall).toHaveBeenCalledWith("rtc_123");
    expect(repository.markParticipantEnded).toHaveBeenCalledWith("interview-1");
  });
});
