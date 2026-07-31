import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TablesInsert } from "@/types/database.types";

export type CreatedIntakeInterview = {
  participantId: string;
  interviewId: string;
};

export interface IntakeRepository {
  createParticipantAndInterview(
    participant: TablesInsert<"participants">,
    interview: Omit<TablesInsert<"interviews">, "participant_id">,
  ): Promise<CreatedIntakeInterview>;
}

export class SupabaseIntakeRepository implements IntakeRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async createParticipantAndInterview(
    participant: TablesInsert<"participants">,
    interview: Omit<TablesInsert<"interviews">, "participant_id">,
  ): Promise<CreatedIntakeInterview> {
    const { data: participantRow, error: participantError } =
      await this.supabase
        .from("participants")
        .insert(participant)
        .select("participant_id")
        .single();

    if (participantError) {
      throw new Error(`Failed to create participant: ${participantError.message}`);
    }

    const { data: interviewRow, error: interviewError } = await this.supabase
      .from("interviews")
      .insert({
        ...interview,
        participant_id: participantRow.participant_id,
      })
      .select("interview_id")
      .single();

    if (interviewError) {
      throw new Error(`Failed to create interview: ${interviewError.message}`);
    }

    return {
      participantId: participantRow.participant_id,
      interviewId: interviewRow.interview_id,
    };
  }
}
