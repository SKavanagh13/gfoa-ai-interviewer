import { describe, expect, it } from "vitest";
import {
  createParticipantSessionToken,
  digestParticipantSessionToken,
  participantSessionCookieName,
  tokenDigestMatches,
} from "@/lib/interview/participant-session";

describe("participant session tokens", () => {
  it("creates a raw token with only an HMAC digest for persistence", () => {
    const token = createParticipantSessionToken({
      interviewId: "11111111-1111-4111-8111-111111111111",
      secret: "test-secret",
      ttlSeconds: 2700,
      now: new Date("2026-07-31T12:00:00.000Z"),
    });

    expect(token.rawToken).not.toEqual(token.digest);
    expect(token.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(token.expiresAt).toBe("2026-07-31T12:45:00.000Z");
  });

  it("binds token digests to the interview ID", () => {
    const rawToken = "raw-token";
    const first = digestParticipantSessionToken({
      interviewId: "interview-1",
      rawToken,
      secret: "test-secret",
    });
    const second = digestParticipantSessionToken({
      interviewId: "interview-2",
      rawToken,
      secret: "test-secret",
    });

    expect(first).not.toBe(second);
    expect(tokenDigestMatches(first, first)).toBe(true);
  });

  it("uses a per-interview cookie name", () => {
    expect(participantSessionCookieName("interview-1")).toBe(
      "gfoa_participant_session_interview-1",
    );
  });
});
