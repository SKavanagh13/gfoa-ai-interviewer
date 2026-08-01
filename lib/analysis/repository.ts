import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json, TablesInsert } from "@/types/database.types";
import { serializeTranscript } from "@/lib/transcript/canonical";
import type { CanonicalTranscriptSegment } from "@/lib/transcript/types";
import {
  ANALYSIS_PROMPT_VERSION,
  OUTPUT_SPECIFICATION_VERSION,
  STRUCTURED_SCHEMA_VERSION,
} from "@/lib/analysis/constants";
import type { PostInterviewOutput } from "@/lib/analysis/types";
import type { VerifiedQuoteForPersistence } from "@/lib/analysis/quote-verification";

export type AnalysisInterviewRecord = {
  interviewId: string;
  transcriptStatus: Database["public"]["Enums"]["transcript_status"];
  participantContext: Record<string, string | null>;
};

export type AnalysisRunInsert = {
  interviewId: string;
  analysisModel: string;
};

export class AnalysisRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async loadInterviewForAnalysis(
    interviewId: string,
  ): Promise<AnalysisInterviewRecord | null> {
    const { data, error } = await this.supabase
      .from("interviews")
      .select(
        "interview_id, transcript_status, participants(government_type, state_or_region, organization_size_band, experience_band)",
      )
      .eq("interview_id", interviewId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load interview: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    const participant = Array.isArray(data.participants)
      ? data.participants[0]
      : data.participants;

    return {
      interviewId: data.interview_id,
      transcriptStatus: data.transcript_status,
      participantContext: {
        government_type: participant?.government_type ?? null,
        state_or_region: participant?.state_or_region ?? null,
        organization_size_band: participant?.organization_size_band ?? null,
        experience_band: participant?.experience_band ?? null,
      },
    };
  }

  async loadCanonicalTranscriptSegments(
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

  async recordEligibility(decision: {
    interviewId: string;
    eligibility: Database["public"]["Enums"]["analysis_eligibility"];
    supportingObjective: Database["public"]["Enums"]["objective"] | null;
    supportingSegmentIds: string[];
  }): Promise<void> {
    const { error } = await this.supabase.rpc("record_analysis_eligibility", {
      p_interview_id: decision.interviewId,
      p_analysis_eligibility: decision.eligibility,
      p_supporting_objective: decision.supportingObjective ?? "",
      p_supporting_segment_ids: decision.supportingSegmentIds,
    });

    if (error) {
      throw new Error(`Failed to record analysis eligibility: ${error.message}`);
    }
  }

  async createPendingAnalysisRun({
    interviewId,
    analysisModel,
  }: AnalysisRunInsert): Promise<string> {
    const insert: TablesInsert<"analysis_runs"> = {
      interview_id: interviewId,
      status: "pending",
      analysis_model: analysisModel,
      analysis_prompt_version: ANALYSIS_PROMPT_VERSION,
      output_specification_version: OUTPUT_SPECIFICATION_VERSION,
      structured_schema_version: STRUCTURED_SCHEMA_VERSION,
    };

    const { data, error } = await this.supabase
      .from("analysis_runs")
      .insert(insert)
      .select("analysis_id")
      .single();

    if (error) {
      throw new Error(`Failed to create pending analysis run: ${error.message}`);
    }

    return data.analysis_id;
  }

  async markAnalysisRunFailed(
    analysisId: string,
    values: {
      errorMessage: string;
      rawStructuredOutput?: Json | null;
      estimatedInputTokens?: number | null;
      estimatedOutputTokens?: number | null;
      estimatedAnalysisCostUsd?: number | null;
    },
  ): Promise<void> {
    const { data, error } = await this.supabase
      .from("analysis_runs")
      .update({
        status: "failed",
        error_message: values.errorMessage,
        raw_structured_output: values.rawStructuredOutput ?? null,
        estimated_input_tokens: values.estimatedInputTokens ?? null,
        estimated_output_tokens: values.estimatedOutputTokens ?? null,
        estimated_analysis_cost_usd: values.estimatedAnalysisCostUsd ?? null,
      })
      .eq("analysis_id", analysisId)
      .select("interview_id")
      .single();

    if (error) {
      throw new Error(`Failed to mark analysis failed: ${error.message}`);
    }

    await this.refreshInterviewTotalCost(data.interview_id);
  }

  async persistSucceededAnalysis(input: {
    analysisId: string;
    output: PostInterviewOutput;
    rawStructuredOutput: Json;
    estimatedInputTokens: number | null;
    estimatedOutputTokens: number | null;
    estimatedAnalysisCostUsd: number | null;
    verifiedQuotes: VerifiedQuoteForPersistence[];
  }): Promise<void> {
    const objectiveIds = new Map(
      input.output.objective_results.map((result) => [
        result.objective,
        randomUUID(),
      ]),
    );
    const quoteIds = input.verifiedQuotes.map(() => randomUUID());
    const themeIds = input.output.topic_tags.map(() => randomUUID());

    const payload: Json = {
      overall_summary: input.output.overview.overall_summary,
      primary_takeaway: input.output.overview.primary_takeaway,
      additional_issue: input.output.overview.notable_additional_issue,
      overall_quality: input.output.overall_quality,
      key_tension: input.output.cross_cutting_themes.key_tension,
      recurring_concern: input.output.cross_cutting_themes.recurring_concern,
      opportunity_signal:
        input.output.cross_cutting_themes.opportunity_signal,
      emerging_signal: input.output.cross_cutting_themes.emerging_signal,
      limitations: input.output.limitations,
      raw_structured_output: input.rawStructuredOutput,
      estimated_input_tokens: input.estimatedInputTokens,
      estimated_output_tokens: input.estimatedOutputTokens,
      estimated_analysis_cost_usd: input.estimatedAnalysisCostUsd,
      negative_reaction_flag: input.output.negative_reaction_flag,
      objective_results: input.output.objective_results.map((result) => ({
        objective_result_id: requireMapValue(objectiveIds, result.objective),
        objective: result.objective,
        narrative_summary: result.narrative_summary,
        coverage: result.coverage,
        confidence: result.confidence,
        structured_fields: result.structured_fields,
      })),
      objective_segments: input.output.objective_results.flatMap((result) =>
        result.supporting_segment_ids.map((segmentId) => ({
          objective_result_id: requireMapValue(objectiveIds, result.objective),
          segment_id: segmentId,
        })),
      ),
      quotes: input.verifiedQuotes.map((quote, index) => ({
        quote_id: quoteIds[index],
        quote_text: quote.quote_text,
        objective: quote.objective,
        verification_status: quote.verification_status,
        reason_selected: quote.reason_selected,
      })),
      quote_segments: input.verifiedQuotes.flatMap((quote, index) =>
        quote.spans.map((span) => ({
          quote_id: quoteIds[index],
          segment_id: span.segment_id,
          start_offset: span.start_offset,
          end_offset: span.end_offset,
        })),
      ),
      theme_assignments: input.output.topic_tags.map((tag, index) => ({
        theme_assignment_id: themeIds[index],
        label: tag.label,
        description: tag.importance,
      })),
      theme_segments: input.output.topic_tags.flatMap((tag, index) =>
        tag.supporting_segment_ids.map((segmentId) => ({
          theme_assignment_id: themeIds[index],
          segment_id: segmentId,
        })),
      ),
    };

    const { error } = await this.supabase.rpc("persist_succeeded_analysis", {
      p_analysis_id: input.analysisId,
      p_payload: payload,
    });

    if (error) {
      throw new Error(`Failed to persist succeeded analysis: ${error.message}`);
    }

    await this.refreshInterviewTotalCostByAnalysisId(input.analysisId);
  }

  private async refreshInterviewTotalCostByAnalysisId(
    analysisId: string,
  ): Promise<void> {
    const { data, error } = await this.supabase
      .from("analysis_runs")
      .select("interview_id")
      .eq("analysis_id", analysisId)
      .single();

    if (error) {
      throw new Error(`Failed to load analysis interview: ${error.message}`);
    }

    await this.refreshInterviewTotalCost(data.interview_id);
  }

  private async refreshInterviewTotalCost(interviewId: string): Promise<void> {
    const { error } = await this.supabase.rpc("refresh_interview_total_cost", {
      p_interview_id: interviewId,
    });

    if (error) {
      throw new Error(`Failed to refresh interview total cost: ${error.message}`);
    }
  }
}

function requireMapValue<K, V>(map: ReadonlyMap<K, V>, key: K): V {
  const value = map.get(key);

  if (value === undefined) {
    throw new Error("Missing generated persistence identifier.");
  }

  return value;
}

export function buildSegmentMap(segments: readonly CanonicalTranscriptSegment[]) {
  return segments
    .map((segment) =>
      [
        segment.segmentId,
        `sequence=${segment.sequenceNumber}`,
        `speaker=${segment.speaker}`,
        `is_final=${String(segment.isFinal)}`,
      ].join(" | "),
    )
    .join("\n");
}

export function buildSerializedTranscript(
  segments: readonly CanonicalTranscriptSegment[],
): string {
  return serializeTranscript(segments);
}
