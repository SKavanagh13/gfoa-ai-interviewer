"use server";

import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CONSENT_VERSION } from "@/lib/intake/consent";
import { getMemberDirectory } from "@/lib/intake/member-directory";
import {
  interviewInsertFromConsent,
  memberProfileToFormProfile,
  normalizeEmail,
  participantInsertFromProfile,
  validateEmail,
} from "@/lib/intake/profile";
import { SupabaseIntakeRepository } from "@/lib/intake/repository";
import {
  createParticipantSessionToken,
  participantSessionCookieName,
} from "@/lib/interview/participant-session";
import { getServerEnv } from "@/lib/env";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { CreateInterviewState, LookupState } from "@/app/interview/state";

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
  const profileResult = await resolveConsentedEmailOnlyProfile(formData);

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

async function resolveConsentedEmailOnlyProfile(formData: FormData) {
  if (formData.get("consent") !== "on") {
    return {
      ok: false as const,
      errors: ["Consent is required before the interview can begin."],
    };
  }

  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const confirmEmail = normalizeEmail(String(formData.get("confirmEmail") ?? ""));
  const emailError = validateEmail(email);

  if (emailError) {
    return { ok: false as const, errors: [emailError] };
  }

  if (email !== confirmEmail) {
    return {
      ok: false as const,
      errors: ["Email addresses must match."],
    };
  }

  const match = await getMemberDirectory().findByEmail(email);

  if (match) {
    return { ok: true as const, profile: memberProfileToFormProfile(match) };
  }

  return {
    ok: true as const,
    profile: {
      email,
      gfoaMemberId: null,
      name: null,
      title: null,
      organizationName: null,
      governmentType: null,
      stateOrRegion: null,
      organizationSizeBand: null,
      experienceBand: null,
      matchedProfileWasCorrected: false,
    },
  };
}
