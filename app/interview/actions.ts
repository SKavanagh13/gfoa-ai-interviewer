"use server";

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
  const participant = participantInsertFromProfile(profileResult.profile);
  const interview = interviewInsertFromConsent({
    consentVersion: CONSENT_VERSION,
    consentedAt,
  });

  const repository = new SupabaseIntakeRepository(createServiceRoleSupabaseClient());
  const created = await repository.createParticipantAndInterview(
    participant,
    interview,
  );

  redirect(`/interview/created?interviewId=${created.interviewId}`);
}
