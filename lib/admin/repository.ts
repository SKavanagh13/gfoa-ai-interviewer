import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database.types";
import type {
  AdminAnalysisRunDetail,
  AdminAnalysisRunSummary,
  AdminInterviewDetail,
  AdminInterviewListItem,
  AdminObjectiveResult,
  AdminParticipantContext,
  AdminParticipantIdentity,
  AdminQuote,
  AdminTranscriptSegment,
} from "@/lib/admin/types";

type Supabase = SupabaseClient<Database>;
type InterviewRow = Tables<"interviews">;
type AnalysisRunRow = Tables<"analysis_runs">;
type TranscriptSegmentRow = Tables<"transcript_segments">;

export class AdminRepository {
  constructor(private readonly supabase: Supabase) {}

  async loadInterviewList(): Promise<AdminInterviewListItem[]> {
    const { data: interviews, error } = await this.supabase
      .from("interviews")
      .select(
        "interview_id,lifecycle_status,end_disposition,analysis_eligibility,transcript_status,negative_reaction_flag,consented_at,started_at,ended_at,created_at",
      )
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to load interviews: ${error.message}`);
    }

    const interviewIds = interviews.map((interview) => interview.interview_id);
    const latestRuns = await this.loadLatestRunByInterview(interviewIds);

    return interviews.map((interview) => ({
      interviewId: interview.interview_id,
      lifecycleStatus: interview.lifecycle_status,
      endDisposition: interview.end_disposition,
      analysisEligibility: interview.analysis_eligibility,
      transcriptStatus: interview.transcript_status,
      negativeReactionFlag: interview.negative_reaction_flag,
      consentedAt: interview.consented_at,
      startedAt: interview.started_at,
      endedAt: interview.ended_at,
      createdAt: interview.created_at,
      latestAnalysisStatus:
        latestRuns.get(interview.interview_id)?.status ?? null,
      latestAnalysisCreatedAt:
        latestRuns.get(interview.interview_id)?.created_at ?? null,
    }));
  }

  async loadInterviewDetail(input: {
    interviewId: string;
    selectedAnalysisId?: string;
  }): Promise<AdminInterviewDetail | null> {
    const { data: interview, error } = await this.supabase
      .from("interviews")
      .select("*")
      .eq("interview_id", input.interviewId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load interview detail: ${error.message}`);
    }

    if (!interview) {
      return null;
    }

    const [
      participantContext,
      transcriptSegments,
      analysisRuns,
    ] = await Promise.all([
      this.loadParticipantContext(input.interviewId),
      this.loadTranscriptSegments(input.interviewId),
      this.loadAnalysisRuns(input.interviewId),
    ]);

    const selectedRunSummary =
      selectAnalysisRun(analysisRuns, input.selectedAnalysisId) ?? null;
    const selectedAnalysisRun = selectedRunSummary
      ? await this.loadAnalysisRunDetail(selectedRunSummary.analysisId)
      : null;

    return mapInterviewDetail({
      interview,
      participantContext,
      transcriptSegments,
      analysisRuns,
      selectedAnalysisRun,
    });
  }

  async loadParticipantIdentity(
    interviewId: string,
  ): Promise<AdminParticipantIdentity | null> {
    const { data: interview, error: interviewError } = await this.supabase
      .from("interviews")
      .select("participant_id")
      .eq("interview_id", interviewId)
      .maybeSingle();

    if (interviewError) {
      throw new Error(`Failed to load interview identity link: ${interviewError.message}`);
    }

    if (!interview) {
      return null;
    }

    const { data: participant, error } = await this.supabase
      .from("participants")
      .select(
        "participant_id, email, name, gfoa_member_id, title, organization_name",
      )
      .eq("participant_id", interview.participant_id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load participant identity: ${error.message}`);
    }

    if (!participant) {
      return null;
    }

    return {
      participantId: participant.participant_id,
      email: participant.email,
      name: participant.name,
      gfoaMemberId: participant.gfoa_member_id,
      title: participant.title,
      organizationName: participant.organization_name,
    };
  }

  async verifyInterviewAccessible(interviewId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("interviews")
      .select("interview_id")
      .eq("interview_id", interviewId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to verify interview access: ${error.message}`);
    }

    return Boolean(data);
  }

  private async loadParticipantContext(
    interviewId: string,
  ): Promise<AdminParticipantContext | null> {
    const { data, error } = await this.supabase.rpc(
      "load_admin_review_participant_context",
      { p_interview_id: interviewId },
    );

    if (error) {
      throw new Error(`Failed to load participant context: ${error.message}`);
    }

    const row = data?.[0];
    if (!row) {
      return null;
    }

    return {
      participantId: row.participant_id,
      governmentType: row.government_type,
      stateOrRegion: row.state_or_region,
      organizationSizeBand: row.organization_size_band,
      experienceBand: row.experience_band,
    };
  }

  private async loadTranscriptSegments(
    interviewId: string,
  ): Promise<AdminTranscriptSegment[]> {
    const { data, error } = await this.supabase
      .from("transcript_segments")
      .select(
        "segment_id, sequence_number, speaker, text, start_time_ms, end_time_ms, is_final",
      )
      .eq("interview_id", interviewId)
      .order("sequence_number", { ascending: true });

    if (error) {
      throw new Error(`Failed to load transcript segments: ${error.message}`);
    }

    return data.map(mapTranscriptSegment);
  }

  private async loadAnalysisRuns(
    interviewId: string,
  ): Promise<AdminAnalysisRunSummary[]> {
    const { data, error } = await this.supabase
      .from("analysis_runs")
      .select(
        "analysis_id,status,analysis_model,analysis_prompt_version,output_specification_version,structured_schema_version,estimated_input_tokens,estimated_output_tokens,estimated_analysis_cost_usd,error_message,created_at",
      )
      .eq("interview_id", interviewId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to load analysis runs: ${error.message}`);
    }

    return data.map(mapAnalysisRunSummary);
  }

  private async loadAnalysisRunDetail(
    analysisId: string,
  ): Promise<AdminAnalysisRunDetail | null> {
    const { data: run, error } = await this.supabase
      .from("analysis_runs")
      .select("*")
      .eq("analysis_id", analysisId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load analysis run detail: ${error.message}`);
    }

    if (!run) {
      return null;
    }

    const [objectiveResults, quotes] = await Promise.all([
      this.loadObjectiveResults(run.analysis_id),
      this.loadQuotes(run.analysis_id),
    ]);

    return {
      ...mapAnalysisRunSummary(run),
      overallSummary: run.overall_summary,
      primaryTakeaway: run.primary_takeaway,
      additionalIssue: run.additional_issue,
      overallQuality: run.overall_quality,
      keyTension: run.key_tension,
      recurringConcern: run.recurring_concern,
      opportunitySignal: run.opportunity_signal,
      emergingSignal: run.emerging_signal,
      limitations: run.limitations,
      objectiveResults,
      quotes,
    };
  }

  private async loadObjectiveResults(
    analysisId: string,
  ): Promise<AdminObjectiveResult[]> {
    const { data: results, error } = await this.supabase
      .from("objective_results")
      .select("*")
      .eq("analysis_id", analysisId)
      .order("objective", { ascending: true });

    if (error) {
      throw new Error(`Failed to load objective results: ${error.message}`);
    }

    const ids = results.map((result) => result.objective_result_id);
    const evidence = await this.loadObjectiveEvidence(ids);

    return results.map((result) => ({
      objectiveResultId: result.objective_result_id,
      objective: result.objective,
      narrativeSummary: result.narrative_summary,
      coverage: result.coverage,
      confidence: result.confidence,
      structuredFields: result.structured_fields,
      evidence: (evidence.get(result.objective_result_id) ?? []).map(
        (segmentId) => ({ segmentId }),
      ),
    }));
  }

  private async loadObjectiveEvidence(
    objectiveResultIds: string[],
  ): Promise<Map<string, string[]>> {
    if (objectiveResultIds.length === 0) {
      return new Map();
    }

    const { data, error } = await this.supabase
      .from("objective_result_segments")
      .select("objective_result_id, segment_id")
      .in("objective_result_id", objectiveResultIds);

    if (error) {
      throw new Error(`Failed to load objective evidence: ${error.message}`);
    }

    return groupSegmentsByOwner(data, "objective_result_id");
  }

  private async loadQuotes(analysisId: string): Promise<AdminQuote[]> {
    const { data: quotes, error } = await this.supabase
      .from("interview_quotes")
      .select("*")
      .eq("analysis_id", analysisId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`Failed to load quotes: ${error.message}`);
    }

    const quoteIds = quotes.map((quote) => quote.quote_id);
    const segments = await this.loadQuoteSegments(quoteIds);

    return quotes.map((quote) => ({
      quoteId: quote.quote_id,
      quoteText: quote.quote_text,
      objective: quote.objective,
      verificationStatus: quote.verification_status,
      reasonSelected: quote.reason_selected,
      segments: segments.get(quote.quote_id) ?? [],
    }));
  }

  private async loadQuoteSegments(
    quoteIds: string[],
  ): Promise<Map<string, AdminQuote["segments"]>> {
    if (quoteIds.length === 0) {
      return new Map();
    }

    const { data, error } = await this.supabase
      .from("interview_quote_segments")
      .select("quote_id, segment_id, start_offset, end_offset")
      .in("quote_id", quoteIds);

    if (error) {
      throw new Error(`Failed to load quote evidence: ${error.message}`);
    }

    const grouped = new Map<string, AdminQuote["segments"]>();
    data.forEach((row) => {
      grouped.set(row.quote_id, [
        ...(grouped.get(row.quote_id) ?? []),
        {
          segmentId: row.segment_id,
          startOffset: row.start_offset,
          endOffset: row.end_offset,
        },
      ]);
    });
    return grouped;
  }

  private async loadLatestRunByInterview(
    interviewIds: string[],
  ): Promise<Map<string, Pick<AnalysisRunRow, "created_at" | "status">>> {
    if (interviewIds.length === 0) {
      return new Map();
    }

    const { data, error } = await this.supabase
      .from("analysis_runs")
      .select("interview_id, status, created_at")
      .in("interview_id", interviewIds)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to load latest analysis runs: ${error.message}`);
    }

    const latest = new Map<
      string,
      Pick<AnalysisRunRow, "created_at" | "status">
    >();
    data.forEach((run) => {
      if (!latest.has(run.interview_id)) {
        latest.set(run.interview_id, {
          status: run.status,
          created_at: run.created_at,
        });
      }
    });
    return latest;
  }
}

export function selectAnalysisRun(
  runs: readonly AdminAnalysisRunSummary[],
  selectedAnalysisId?: string,
): AdminAnalysisRunSummary | undefined {
  if (selectedAnalysisId) {
    return runs.find((run) => run.analysisId === selectedAnalysisId);
  }

  return (
    runs.find((run) => run.status === "succeeded") ??
    runs[0]
  );
}

function mapInterviewDetail(input: {
  interview: InterviewRow;
  participantContext: AdminParticipantContext | null;
  transcriptSegments: AdminTranscriptSegment[];
  analysisRuns: AdminAnalysisRunSummary[];
  selectedAnalysisRun: AdminAnalysisRunDetail | null;
}): AdminInterviewDetail {
  return {
    interviewId: input.interview.interview_id,
    participantId: input.interview.participant_id,
    lifecycleStatus: input.interview.lifecycle_status,
    endDisposition: input.interview.end_disposition,
    analysisEligibility: input.interview.analysis_eligibility,
    analysisEligibilitySupportingObjective:
      input.interview.analysis_eligibility_supporting_objective,
    transcriptStatus: input.interview.transcript_status,
    transcriptProcessingError: input.interview.transcript_processing_error,
    negativeReactionFlag: input.interview.negative_reaction_flag,
    consentVersion: input.interview.consent_version,
    consentedAt: input.interview.consented_at,
    startedAt: input.interview.started_at,
    endedAt: input.interview.ended_at,
    durationSeconds: input.interview.duration_seconds,
    operatingPrinciplesVersion: input.interview.operating_principles_version,
    interviewGuideVersion: input.interview.interview_guide_version,
    livePromptVersion: input.interview.live_prompt_version,
    audioStoragePath: input.interview.audio_storage_path,
    transcriptStoragePath: input.interview.transcript_storage_path,
    browserConnectionStatus: input.interview.browser_connection_status,
    sidebandConnectionStatus: input.interview.sideband_connection_status,
    estimatedInputTokens: input.interview.estimated_input_tokens,
    estimatedOutputTokens: input.interview.estimated_output_tokens,
    estimatedLiveCostUsd: nullableNumeric(input.interview.estimated_live_cost_usd),
    estimatedTotalCostUsd: nullableNumeric(
      input.interview.estimated_total_cost_usd,
    ),
    costCategory: input.interview.cost_category,
    technicalError: input.interview.technical_error,
    createdAt: input.interview.created_at,
    participantContext: input.participantContext,
    transcriptSegments: input.transcriptSegments,
    analysisRuns: input.analysisRuns,
    selectedAnalysisRun: input.selectedAnalysisRun,
  };
}

function mapTranscriptSegment(
  segment: Pick<
    TranscriptSegmentRow,
    | "segment_id"
    | "sequence_number"
    | "speaker"
    | "text"
    | "start_time_ms"
    | "end_time_ms"
    | "is_final"
  >,
): AdminTranscriptSegment {
  return {
    segmentId: segment.segment_id,
    sequenceNumber: segment.sequence_number,
    speaker: segment.speaker,
    text: segment.text,
    startTimeMs: segment.start_time_ms,
    endTimeMs: segment.end_time_ms,
    isFinal: segment.is_final,
  };
}

function mapAnalysisRunSummary(
  run: Pick<
    AnalysisRunRow,
    | "analysis_id"
    | "status"
    | "analysis_model"
    | "analysis_prompt_version"
    | "output_specification_version"
    | "structured_schema_version"
    | "estimated_input_tokens"
    | "estimated_output_tokens"
    | "estimated_analysis_cost_usd"
    | "error_message"
    | "created_at"
  >,
): AdminAnalysisRunSummary {
  return {
    analysisId: run.analysis_id,
    status: run.status,
    analysisModel: run.analysis_model,
    analysisPromptVersion: run.analysis_prompt_version,
    outputSpecificationVersion: run.output_specification_version,
    structuredSchemaVersion: run.structured_schema_version,
    estimatedInputTokens: run.estimated_input_tokens,
    estimatedOutputTokens: run.estimated_output_tokens,
    estimatedAnalysisCostUsd: nullableNumeric(run.estimated_analysis_cost_usd),
    errorMessage: run.error_message,
    createdAt: run.created_at,
  };
}

function groupSegmentsByOwner<T extends { objective_result_id: string; segment_id: string }>(
  rows: T[],
  ownerKey: keyof Pick<T, "objective_result_id">,
): Map<string, string[]> {
  const grouped = new Map<string, string[]>();
  rows.forEach((row) => {
    const ownerId = String(row[ownerKey]);
    grouped.set(ownerId, [...(grouped.get(ownerId) ?? []), row.segment_id]);
  });
  return grouped;
}

function nullableNumeric(value: string | number | null): string | null {
  return value === null ? null : String(value);
}
