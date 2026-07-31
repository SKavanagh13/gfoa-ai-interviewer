import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TablesInsert } from "@/types/database.types";
import { validateTranscriptForCanonicalUse } from "@/lib/transcript/canonical";
import type { CanonicalTranscriptSegment } from "@/lib/transcript/types";
import {
  digestParticipantSessionToken,
  tokenDigestMatches,
} from "@/lib/interview/participant-session";

export type LiveInterviewContext = {
  interviewId: string;
  participantId: string;
  consentVersion: string;
  consentedAt: string;
  realtimeCallId: string | null;
  participantContext: {
    governmentType: string | null;
    stateOrRegion: string | null;
    organizationSizeBand: string | null;
    experienceBand: string | null;
  };
};

export type FinalTranscriptSegment = {
  speaker: "participant" | "interviewer" | "system";
  text: string;
  providerEventId?: string | null;
  startTimeMs?: number | null;
  endTimeMs?: number | null;
};

export class InterviewSessionRepository {
  constructor(
    private readonly supabase: SupabaseClient<Database>,
    private readonly tokenSecret: string,
  ) {}

  async validateParticipantSession(
    interviewId: string,
    rawToken: string | undefined,
  ): Promise<boolean> {
    if (!rawToken) {
      return false;
    }

    const { data, error } = await this.supabase
      .from("participant_session_tokens")
      .select("token_digest, expires_at")
      .eq("interview_id", interviewId)
      .maybeSingle();

    if (error || !data || new Date(data.expires_at).getTime() <= Date.now()) {
      return false;
    }

    const digest = digestParticipantSessionToken({
      interviewId,
      rawToken,
      secret: this.tokenSecret,
    });

    return tokenDigestMatches(data.token_digest, digest);
  }

  async getLiveInterviewContext(
    interviewId: string,
  ): Promise<LiveInterviewContext | null> {
    const { data, error } = await this.supabase
      .from("interviews")
      .select(
        "interview_id, participant_id, consent_version, consented_at, realtime_call_id, participants(government_type, state_or_region, organization_size_band, experience_band)",
      )
      .eq("interview_id", interviewId)
      .maybeSingle();

    if (error || !data || !data.consent_version || !data.consented_at) {
      return null;
    }

    const participant = Array.isArray(data.participants)
      ? data.participants[0]
      : data.participants;

    return {
      interviewId: data.interview_id,
      participantId: data.participant_id,
      consentVersion: data.consent_version,
      consentedAt: data.consented_at,
      realtimeCallId: data.realtime_call_id,
      participantContext: {
        governmentType: participant?.government_type ?? null,
        stateOrRegion: participant?.state_or_region ?? null,
        organizationSizeBand: participant?.organization_size_band ?? null,
        experienceBand: participant?.experience_band ?? null,
      },
    };
  }

  async persistRealtimeCallId(
    interviewId: string,
    callId: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .from("interviews")
      .update({ realtime_call_id: callId })
      .eq("interview_id", interviewId);

    if (error) {
      throw new Error(`Failed to persist Realtime call ID: ${error.message}`);
    }
  }

  async markBrowserConnected(interviewId: string): Promise<void> {
    await this.updateInterview(interviewId, {
      browser_connection_status: "connected",
    });
    await this.tryMarkInterviewActive(interviewId);
  }

  async markSidebandConnected(interviewId: string): Promise<void> {
    await this.updateInterview(interviewId, {
      sideband_connection_status: "connected",
    });
    await this.tryMarkInterviewActive(interviewId);
  }

  async tryMarkInterviewActive(interviewId: string): Promise<string | null> {
    const { data, error } = await this.supabase.rpc("try_mark_interview_active", {
      p_interview_id: interviewId,
    });

    if (error) {
      throw new Error(`Failed to mark interview active: ${error.message}`);
    }

    return data;
  }

  async markTechnicalFailure(
    interviewId: string,
    technicalError: string,
  ): Promise<void> {
    await this.updateInterview(interviewId, {
      lifecycle_status: "failed",
      end_disposition: "technical_failure",
      sideband_connection_status: "failed",
      technical_error: technicalError,
      cost_category: "technical_failure",
      ended_at: new Date().toISOString(),
    });
  }

  async markParticipantEnded(interviewId: string): Promise<void> {
    await this.updateInterview(interviewId, {
      browser_connection_status: "closed",
      ended_at: new Date().toISOString(),
    });

    const { error } = await this.supabase
      .from("interviews")
      .update({
        lifecycle_status: "ended",
        end_disposition: "participant_ended",
        ended_at: new Date().toISOString(),
        transcript_status: "stabilizing",
      })
      .eq("interview_id", interviewId)
      .is("end_disposition", null)
      .neq("lifecycle_status", "failed");

    if (error) {
      throw new Error(`Failed to mark participant ended: ${error.message}`);
    }
  }

  async markTranscriptStable(
    interviewId: string,
    timeoutMs: number,
  ): Promise<void> {
    const transcriptSegments =
      await this.loadCanonicalTranscriptSegments(interviewId);
    const validation = validateTranscriptForCanonicalUse(transcriptSegments);

    if (!validation.ok) {
      await this.markTranscriptFailed(
        interviewId,
        timeoutMs,
        validation.errorMessage,
      );
      return;
    }

    await this.updateInterview(interviewId, {
      transcript_status: "stable",
      transcript_stabilized_at: new Date().toISOString(),
      transcript_reconciliation_timeout_ms: timeoutMs,
    });
  }

  async markTranscriptFailed(
    interviewId: string,
    timeoutMs: number,
    errorMessage: string,
  ): Promise<void> {
    await this.updateInterview(interviewId, {
      transcript_status: "failed",
      transcript_reconciliation_timeout_ms: timeoutMs,
      transcript_processing_error: errorMessage,
    });
  }

  async insertFinalTranscriptSegment(
    interviewId: string,
    segment: FinalTranscriptSegment,
  ): Promise<void> {
    const text = segment.text.trim();

    if (!text) {
      return;
    }

    if (segment.providerEventId) {
      const { data: existing, error: existingError } = await this.supabase
        .from("transcript_segments")
        .select("segment_id")
        .eq("interview_id", interviewId)
        .eq("provider_event_id", segment.providerEventId)
        .maybeSingle();

      if (existingError) {
        throw new Error(
          `Failed to check transcript segment idempotency: ${existingError.message}`,
        );
      }

      if (existing) {
        return;
      }
    }

    const { data: latest, error: latestError } = await this.supabase
      .from("transcript_segments")
      .select("sequence_number")
      .eq("interview_id", interviewId)
      .order("sequence_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) {
      throw new Error(
        `Failed to read latest transcript sequence: ${latestError.message}`,
      );
    }

    const insert: TablesInsert<"transcript_segments"> = {
      interview_id: interviewId,
      sequence_number: (latest?.sequence_number ?? 0) + 1,
      speaker: segment.speaker,
      text,
      provider_event_id: segment.providerEventId ?? null,
      start_time_ms: segment.startTimeMs ?? null,
      end_time_ms: segment.endTimeMs ?? null,
      is_final: true,
    };

    const { error } = await this.supabase.from("transcript_segments").insert(insert);

    if (error) {
      throw new Error(`Failed to insert transcript segment: ${error.message}`);
    }
  }

  async recordUsage(
    interviewId: string,
    usage: { inputTokens?: number; outputTokens?: number },
  ): Promise<void> {
    const { data, error } = await this.supabase
      .from("interviews")
      .select("estimated_input_tokens, estimated_output_tokens")
      .eq("interview_id", interviewId)
      .single();

    if (error) {
      throw new Error(`Failed to read usage totals: ${error.message}`);
    }

    await this.updateInterview(interviewId, {
      estimated_input_tokens:
        (data.estimated_input_tokens ?? 0) + (usage.inputTokens ?? 0),
      estimated_output_tokens:
        (data.estimated_output_tokens ?? 0) + (usage.outputTokens ?? 0),
    });
  }

  private async loadCanonicalTranscriptSegments(
    interviewId: string,
  ): Promise<CanonicalTranscriptSegment[]> {
    const { data, error } = await this.supabase
      .from("transcript_segments")
      .select(
        "segment_id, interview_id, sequence_number, speaker, text, start_time_ms, end_time_ms, provider_event_id, is_final",
      )
      .eq("interview_id", interviewId)
      .order("sequence_number", { ascending: true });

    if (error) {
      throw new Error(`Failed to load canonical transcript: ${error.message}`);
    }

    return data.map((segment) => ({
      segmentId: segment.segment_id,
      interviewId: segment.interview_id,
      sequenceNumber: segment.sequence_number,
      speaker: segment.speaker,
      text: segment.text,
      startTimeMs: segment.start_time_ms,
      endTimeMs: segment.end_time_ms,
      providerEventId: segment.provider_event_id,
      isFinal: segment.is_final,
    }));
  }

  private async updateInterview(
    interviewId: string,
    values: Database["public"]["Tables"]["interviews"]["Update"],
  ): Promise<void> {
    const { error } = await this.supabase
      .from("interviews")
      .update(values)
      .eq("interview_id", interviewId);

    if (error) {
      throw new Error(`Failed to update interview: ${error.message}`);
    }
  }
}
