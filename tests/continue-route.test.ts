import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/interview/[interviewId]/continue/route";
import { createAuthorizedParticipantRepository } from "@/lib/interview/route-auth";

vi.mock("@/lib/interview/route-auth", () => ({
  createAuthorizedParticipantRepository: vi.fn(),
}));

describe("continuation consent route", () => {
  beforeEach(() => {
    vi.mocked(createAuthorizedParticipantRepository).mockReset();
  });

  it("returns 401 without an authorized participant session", async () => {
    const repository = {
      recordContinuationConsent: vi.fn(async () => {}),
    };
    vi.mocked(createAuthorizedParticipantRepository).mockResolvedValue(null);

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ interviewId: "interview-1" }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(repository.recordContinuationConsent).not.toHaveBeenCalled();
  });

  it("records continuation consent for an authorized participant session", async () => {
    const repository = {
      recordContinuationConsent: vi.fn(async () => {}),
    };
    vi.mocked(createAuthorizedParticipantRepository).mockResolvedValue(
      repository as never,
    );

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ interviewId: "interview-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(createAuthorizedParticipantRepository).toHaveBeenCalledWith(
      "interview-1",
    );
    expect(repository.recordContinuationConsent).toHaveBeenCalledWith(
      "interview-1",
    );
  });

  it("rejects a participant session scoped to a different interview", async () => {
    const repository = {
      recordContinuationConsent: vi.fn(async () => {}),
    };
    vi.mocked(createAuthorizedParticipantRepository).mockImplementation(
      async (interviewId) =>
        interviewId === "allowed-interview" ? (repository as never) : null,
    );

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ interviewId: "other-interview" }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(createAuthorizedParticipantRepository).toHaveBeenCalledWith(
      "other-interview",
    );
    expect(repository.recordContinuationConsent).not.toHaveBeenCalled();
  });
});
