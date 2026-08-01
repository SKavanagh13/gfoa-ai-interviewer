import type { Json } from "@/types/database.types";
import type { Objective } from "@/lib/analysis/constants";
import type { CanonicalTranscriptSegment } from "@/lib/transcript/types";

export type StructuredFieldValueStatus =
  | "supported"
  | "not_discussed"
  | "unclear";

export type StructuredField = {
  field_name: string;
  value: string | null;
  value_status: StructuredFieldValueStatus;
};

export type AnalysisObjectiveResult = {
  objective: Objective;
  narrative_summary: string;
  coverage:
    | "sufficiently_covered"
    | "partially_covered"
    | "not_covered"
    | "unclear";
  confidence: "high" | "moderate" | "low";
  structured_fields: StructuredField[];
  supporting_segment_ids: string[];
};

export type TopicTag = {
  label: string;
  importance: "primary" | "secondary";
  supporting_segment_ids: string[];
};

export type RepresentativeQuoteProposal = {
  quote_text: string;
  related_objective: Objective | null;
  reason_selected: string;
  proposed_segment_ids: string[];
};

export type PostInterviewOutput = {
  overview: {
    overall_summary: string;
    primary_takeaway: string;
    notable_additional_issue: string;
  };
  objective_results: AnalysisObjectiveResult[];
  cross_cutting_themes: {
    key_tension: string;
    recurring_concern: string;
    opportunity_signal: string;
    emerging_signal: string;
  };
  topic_tags: TopicTag[];
  representative_quotes: RepresentativeQuoteProposal[];
  overall_quality: "strong" | "adequate" | "limited" | "unusable";
  limitations: string | null;
  negative_reaction_flag: boolean | null;
};

export type EligibilityModelResult = {
  eligible: boolean;
  supporting_objective: Objective | null;
  supporting_segment_ids: string[];
  rationale: string;
};

export type AnalysisUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
};

export type StructuredOutputModelResult = {
  parsed: unknown | null;
  rawResponse: Json;
  usage: AnalysisUsage;
  refusal: string | null;
  errorMessage: string | null;
};

export type AnalysisTranscriptContext = {
  interviewId: string;
  segments: CanonicalTranscriptSegment[];
  serializedTranscript: string;
};
