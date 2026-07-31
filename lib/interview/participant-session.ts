import crypto from "node:crypto";

export const PARTICIPANT_SESSION_COOKIE_PREFIX = "gfoa_participant_session";

export type ParticipantSessionToken = {
  rawToken: string;
  digest: string;
  expiresAt: string;
};

export function participantSessionCookieName(interviewId: string): string {
  return `${PARTICIPANT_SESSION_COOKIE_PREFIX}_${interviewId}`;
}

export function createParticipantSessionToken(input: {
  interviewId: string;
  secret: string;
  ttlSeconds: number;
  now?: Date;
}): ParticipantSessionToken {
  const now = input.now ?? new Date();
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + input.ttlSeconds * 1000).toISOString();

  return {
    rawToken,
    digest: digestParticipantSessionToken({
      interviewId: input.interviewId,
      rawToken,
      secret: input.secret,
    }),
    expiresAt,
  };
}

export function digestParticipantSessionToken(input: {
  interviewId: string;
  rawToken: string;
  secret: string;
}): string {
  return crypto
    .createHmac("sha256", input.secret)
    .update(input.interviewId)
    .update(":")
    .update(input.rawToken)
    .digest("hex");
}

export function tokenDigestMatches(expected: string, actual: string): boolean {
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(actual, "hex");

  return (
    expectedBuffer.length === actualBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  );
}
