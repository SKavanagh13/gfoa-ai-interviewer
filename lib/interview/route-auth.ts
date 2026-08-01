import "server-only";

import { cookies } from "next/headers";
import { getServerEnv } from "@/lib/env";
import { participantSessionCookieName } from "@/lib/interview/participant-session";
import { InterviewSessionRepository } from "@/lib/interview/session-repository";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export async function createAuthorizedParticipantRepository(
  interviewId: string,
): Promise<InterviewSessionRepository | null> {
  const env = getServerEnv();
  const repository = new InterviewSessionRepository(
    createServiceRoleSupabaseClient(),
    env.PARTICIPANT_SESSION_TOKEN_SECRET,
    env.OPENAI_REALTIME_MODEL,
  );
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(participantSessionCookieName(interviewId))?.value;
  const isValid = await repository.validateParticipantSession(
    interviewId,
    rawToken,
  );

  return isValid ? repository : null;
}
