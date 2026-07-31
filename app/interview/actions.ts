"use server";

import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CONSENT_VERSION } from "@/lib/intake/consent";
import { getMemberDirectory } from "@/lib/intake/member-directory";
import {
  interviewInsertFromConsent,
  memberProfileToFormProfile,
  participantInsertFromProfile,
  validateConsentedProfileForm,
  validateEmail,
} from "@/lib/intake/profile";
import { SupabaseIntakeRepository } from "@/lib/intake/repository";
import {
  createParticipantSessionToken,
  participantSessionCookieName,
} from "@/lib/interview/participant-session";
import { getServerEnv } from "@/lib/env";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export type LookupState = {
  email: string;
  errors: string[];
  match:
    | ReturnType<typeof memberProfileToFormProfile>
    | null;
  searched: boolean;
};

export type CreateInterviewState = {
  errors: string[];
};

export const initialLookupState: LookupState = {
  email: "",
  errors: [],
  match: null,
  searched: false,
};

export const initialCreateInterviewState: CreateInterviewState = {
  errors: [],
};

export async function lookupMember(
  _previousState: LookupState,
  formData: FormData,
): Promise<LookupState> {
  const email = String(formData.get("email") ?? "");
  const emailError = validateEmail(email);

  if (emailError) {
    return {
      email,
      errors: [emailError],
      match: null,
      searched: false,
    };
  }

  const directory = getMemberDirectory();
  const match = await directory.findByEmail(email);

  return {
    email,
    errors: [],
    match: match ? memberProfileToFormProfile(match) : null,
    searched: true,
  };
}

export async function createInterview(
  _previousState: CreateInterviewState,
  formData: FormData,
): Promise<CreateInterviewState> {
  const profileResult = validateConsentedProfileForm(formData);

  if (!profileResult.ok) {
    return { errors: profileResult.errors };
  }

  const consentedAt = new Date().toISOString();
  const interviewId = crypto.randomUUID();
  const participant = participantInsertFromProfile(profileResult.profile);
  const interview = interviewInsertFromConsent({
    consentVersion: CONSENT_VERSION,
    consentedAt,
  });

  let created;
  let participantSession;

  try {
    const serverEnv = getServerEnv();
    const repository = new SupabaseIntakeRepository(
      createServiceRoleSupabaseClient(),
    );
    participantSession = createParticipantSessionToken({
      interviewId,
      secret: serverEnv.PARTICIPANT_SESSION_TOKEN_SECRET,
      ttlSeconds: Number(serverEnv.PARTICIPANT_SESSION_TOKEN_TTL_SECONDS),
    });
    created = await repository.createParticipantAndInterview(
      participant,
      { ...interview, interview_id: interviewId },
      {
        tokenDigest: participantSession.digest,
        expiresAt: participantSession.expiresAt,
      },
    );
  } catch {
    return {
      errors: [
        "We could not create the interview record. Please try again in a moment.",
      ],
    };
  }

  const cookieStore = await cookies();
  cookieStore.set(participantSessionCookieName(created.interviewId), participantSession.rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(participantSession.expiresAt),
    path: "/",
  });

  redirect(`/interview/created?interviewId=${created.interviewId}`);
}
