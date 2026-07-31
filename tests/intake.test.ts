import { describe, expect, it, vi } from "vitest";
import { createInterview } from "@/app/interview/actions";
import { CONSENT_VERSION } from "@/lib/intake/consent";
import { MockMemberDirectory } from "@/lib/intake/member-directory";
import {
  interviewInsertFromConsent,
  participantInsertFromProfile,
  validateConsentedProfileForm,
  validateProfileForm,
} from "@/lib/intake/profile";

vi.mock("server-only", () => ({}));

describe("member directory abstraction", () => {
  it("finds a matched member by normalized email", async () => {
    const directory = new MockMemberDirectory();

    await expect(
      directory.findByEmail("  MATCHED.MEMBER@gfoa.org "),
    ).resolves.toMatchObject({
      gfoaMemberId: "mock-member-001",
      title: "Finance Director",
    });
  });

  it("returns null when no member profile matches", async () => {
    const directory = new MockMemberDirectory();

    await expect(directory.findByEmail("unknown@example.org")).resolves.toBeNull();
  });
});

describe("intake profile validation", () => {
  it("allows a matched profile to be confirmed without changing membership data", () => {
    const formData = new FormData();
    formData.set("source", "matched");
    formData.set("email", "MATCHED.MEMBER@gfoa.org");
    formData.set("gfoaMemberId", "mock-member-001");
    formData.set("name", "Jordan Lee");
    formData.set("title", "Finance Director");
    formData.set("organizationName", "Example City");
    formData.set("governmentType", "Municipality");
    formData.set("stateOrRegion", "Midwest");

    const result = validateProfileForm(formData);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(participantInsertFromProfile(result.profile)).toMatchObject({
      email: "matched.member@gfoa.org",
      gfoa_member_id: "mock-member-001",
      organization_name: "Example City",
      profile_status: "matched_confirmed",
    });
  });

  it("records matched profiles as corrected when the participant changes fields", () => {
    const formData = new FormData();
    formData.set("source", "matched");
    formData.set("email", "matched.member@gfoa.org");
    formData.set("gfoaMemberId", "mock-member-001");
    formData.set("title", "Updated Title");
    formData.set("governmentType", "County");
    formData.set("stateOrRegion", "West");
    formData.set("matchedProfileWasCorrected", "on");

    const result = validateProfileForm(formData);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(participantInsertFromProfile(result.profile).profile_status).toBe(
      "matched_corrected",
    );
  });

  it("requires only the minimum unmatched profile fields", () => {
    const formData = new FormData();
    formData.set("source", "unmatched");
    formData.set("email", "new.person@example.org");
    formData.set("title", "Budget Manager");
    formData.set("governmentType", "Special district");
    formData.set("stateOrRegion", "South");
    formData.set("name", "Should Not Persist");
    formData.set("organizationName", "Should Not Persist");

    const result = validateProfileForm(formData);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(participantInsertFromProfile(result.profile)).toMatchObject({
      email: "new.person@example.org",
      gfoa_member_id: null,
      name: null,
      organization_name: null,
      profile_status: "unmatched_minimum_collected",
    });
  });

  it("rejects unmatched intake missing minimum required fields", () => {
    const formData = new FormData();
    formData.set("source", "unmatched");
    formData.set("email", "new.person@example.org");

    const result = validateProfileForm(formData);

    expect(result).toEqual({
      ok: false,
      errors: [
        "Title or role is required.",
        "Government type is required.",
        "State or region is required.",
      ],
    });
  });
});

describe("consent-backed interview creation", () => {
  it("stores the consent version and timestamp on new interview records", () => {
    expect(
      interviewInsertFromConsent({
        consentVersion: CONSENT_VERSION,
        consentedAt: "2026-07-30T20:00:00.000Z",
      }),
    ).toMatchObject({
      consent_version: CONSENT_VERSION,
      consented_at: "2026-07-30T20:00:00.000Z",
      operating_principles_version:
        "docs/locked/01-ai-interviewer-operating-principles.md",
      interview_guide_version: "docs/locked/02-ai-interviewer-guide.md",
      live_prompt_version: "prompts/live-interviewer.system.md",
    });
  });

  it("does not create an interview when affirmative consent is missing", async () => {
    const formData = new FormData();
    formData.set("source", "unmatched");
    formData.set("email", "new.person@example.org");
    formData.set("title", "Budget Manager");
    formData.set("governmentType", "Special district");
    formData.set("stateOrRegion", "South");

    expect(validateConsentedProfileForm(formData)).toStrictEqual({
      errors: ["Consent is required before the interview can begin."],
      ok: false,
    });
  });

  it("does not reach persistence when profile validation fails", async () => {
    const formData = new FormData();
    formData.set("source", "unmatched");
    formData.set("email", "new.person@example.org");
    formData.set("consent", "on");

    expect(validateConsentedProfileForm(formData)).toStrictEqual({
      errors: [
        "Title or role is required.",
        "Government type is required.",
        "State or region is required.",
      ],
      ok: false,
    });
  });

  it("returns a form error when persistence fails", async () => {
    const formData = new FormData();
    formData.set("source", "unmatched");
    formData.set("email", "new.person@example.org");
    formData.set("title", "Budget Manager");
    formData.set("governmentType", "Special district");
    formData.set("stateOrRegion", "South");
    formData.set("consent", "on");

    await expect(createInterview({ errors: [] }, formData)).resolves.toEqual({
      errors: [
        "We could not create the interview record. Please try again in a moment.",
      ],
    });
  });
});
