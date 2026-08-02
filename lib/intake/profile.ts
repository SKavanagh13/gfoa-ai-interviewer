import type { TablesInsert } from "@/types/database.types";
import type { MemberProfile } from "@/lib/intake/member-directory";

export type IntakeProfileInput = {
  email: string;
  gfoaMemberId?: string | null;
  name?: string | null;
  title?: string | null;
  organizationName?: string | null;
  governmentType?: string | null;
  stateOrRegion?: string | null;
  organizationSizeBand?: string | null;
  experienceBand?: string | null;
  matchedProfileWasCorrected: boolean;
};

export type IntakeValidationResult =
  | { ok: true; profile: IntakeProfileInput }
  | { ok: false; errors: string[] };

export type CreatedInterviewInput = {
  consentVersion: string;
  consentedAt: string;
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function nullableText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function validateEmail(email: string): string | null {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return "Email is required.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return "Enter a valid email address.";
  }

  return null;
}

export function memberProfileToFormProfile(
  memberProfile: MemberProfile,
): IntakeProfileInput {
  return {
    email: normalizeEmail(memberProfile.email),
    gfoaMemberId: memberProfile.gfoaMemberId,
    name: memberProfile.name,
    title: memberProfile.title,
    organizationName: memberProfile.organizationName,
    governmentType: memberProfile.governmentType,
    stateOrRegion: memberProfile.stateOrRegion,
    organizationSizeBand: memberProfile.organizationSizeBand,
    experienceBand: memberProfile.experienceBand,
    matchedProfileWasCorrected: false,
  };
}

export function validateProfileForm(
  formData: FormData,
): IntakeValidationResult {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const source = String(formData.get("source") ?? "");
  const errors: string[] = [];
  const emailError = validateEmail(email);

  if (emailError) {
    errors.push(emailError);
  }

  const gfoaMemberId = nullableText(formData.get("gfoaMemberId"));
  if (source !== "matched" && source !== "unmatched") {
    errors.push("Profile source is invalid.");
  }

  const profile: IntakeProfileInput = {
    email,
    gfoaMemberId,
    name: nullableText(formData.get("name")),
    title: nullableText(formData.get("title")),
    organizationName: nullableText(formData.get("organizationName")),
    governmentType: nullableText(formData.get("governmentType")),
    stateOrRegion: nullableText(formData.get("stateOrRegion")),
    organizationSizeBand: nullableText(formData.get("organizationSizeBand")),
    experienceBand: nullableText(formData.get("experienceBand")),
    matchedProfileWasCorrected: false,
  };

  if (!gfoaMemberId) {
    profile.gfoaMemberId = null;
    profile.name = null;
    profile.title = null;
    profile.organizationName = null;
    profile.governmentType = null;
    profile.stateOrRegion = null;
    profile.organizationSizeBand = null;
    profile.experienceBand = null;
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, profile };
}

export function validateConsentedProfileForm(
  formData: FormData,
): IntakeValidationResult {
  if (formData.get("consent") !== "on") {
    return {
      ok: false,
      errors: ["Consent is required before the interview can begin."],
    };
  }

  return validateProfileForm(formData);
}

export function participantInsertFromProfile(
  profile: IntakeProfileInput,
): TablesInsert<"participants"> {
  const hasMemberId = Boolean(profile.gfoaMemberId);

  return {
    email: profile.email,
    gfoa_member_id: profile.gfoaMemberId ?? null,
    name: profile.name ?? null,
    title: profile.title ?? null,
    organization_name: profile.organizationName ?? null,
    government_type: profile.governmentType ?? null,
    state_or_region: profile.stateOrRegion ?? null,
    organization_size_band: profile.organizationSizeBand ?? null,
    experience_band: profile.experienceBand ?? null,
    profile_status: hasMemberId
      ? "matched_confirmed"
      : "unmatched_minimum_collected",
    profile_confirmed_at: new Date().toISOString(),
  };
}

export function interviewInsertFromConsent(
  input: CreatedInterviewInput,
): Omit<TablesInsert<"interviews">, "participant_id"> {
  return {
    consent_version: input.consentVersion,
    consented_at: input.consentedAt,
    operating_principles_version:
      "docs/locked/01-ai-interviewer-operating-principles.md",
    interview_guide_version: "docs/locked/02-ai-interviewer-guide.md",
    live_prompt_version: "prompts/live-interviewer.system.md",
  };
}
