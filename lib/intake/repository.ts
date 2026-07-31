import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TablesInsert } from "@/types/database.types";

export type CreatedIntakeInterview = {
  participantId: string;
  interviewId: string;
};

export type ParticipantSessionInsert = {
  tokenDigest: string;
  expiresAt: string;
};

export interface IntakeRepository {
  createParticipantAndInterview(
    participant: TablesInsert<"participants">,
    interview: Omit<TablesInsert<"interviews">, "participant_id"> & {
      interview_id: string;
    },
    participantSession: ParticipantSessionInsert,
  ): Promise<CreatedIntakeInterview>;
}

export class SupabaseIntakeRepository implements IntakeRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async createParticipantAndInterview(
    participant: TablesInsert<"participants">,
    interview: Omit<TablesInsert<"interviews">, "participant_id"> & {
      interview_id: string;
    },
    participantSession: ParticipantSessionInsert,
  ): Promise<CreatedIntakeInterview> {
    const { data, error } = await this.supabase
      .rpc("create_participant_and_interview", {
        p_email: participant.email,
        p_gfoa_member_id: participant.gfoa_member_id ?? "",
        p_name: participant.name ?? "",
        p_title: participant.title ?? "",
        p_organization_name: participant.organization_name ?? "",
        p_government_type: participant.government_type ?? "",
        p_state_or_region: participant.state_or_region ?? "",
        p_organization_size_band: participant.organization_size_band ?? "",
        p_experience_band: participant.experience_band ?? "",
        p_profile_status: participant.profile_status ?? "not_confirmed",
        p_profile_confirmed_at:
          participant.profile_confirmed_at ?? new Date().toISOString(),
        p_consent_version: interview.consent_version ?? "",
        p_consented_at: interview.consented_at ?? new Date().toISOString(),
        p_interview_id: interview.interview_id,
        p_operating_principles_version:
          interview.operating_principles_version ?? "",
        p_interview_guide_version: interview.interview_guide_version ?? "",
        p_live_prompt_version: interview.live_prompt_version ?? "",
        p_participant_session_token_digest: participantSession.tokenDigest,
        p_participant_session_expires_at: participantSession.expiresAt,
      })
      .single();

    if (error) {
      throw new Error(
        `Failed to create participant and interview: ${error.message}`,
      );
    }

    return {
      participantId: data.participant_id,
      interviewId: data.interview_id,
    };
  }
}
