import type { Database } from "@/types/database.types";

export const ANALYSIS_PROMPT_VERSION = "wave5-post-interview-analysis-v1";
export const OUTPUT_SPECIFICATION_VERSION =
  "locked-03-per-interview-output-specification";
export const STRUCTURED_SCHEMA_VERSION = "wave5-post-interview-output-v1";
export const ELIGIBILITY_PROMPT_VERSION = "wave5-analysis-eligibility-v1";
export const ELIGIBILITY_SCHEMA_VERSION = "wave5-analysis-eligibility-v1";

export const OBJECTIVES = [
  "current_issue",
  "enduring_concern",
  "theory_vs_practice",
  "recent_change",
  "unmet_need",
  "innovation_orientation",
] as const satisfies readonly Database["public"]["Enums"]["objective"][];

export type Objective = (typeof OBJECTIVES)[number];

export const OBJECTIVE_LABELS: Record<Objective, string> = {
  current_issue: "Current Issue",
  enduring_concern: "Enduring Concern",
  theory_vs_practice: "Theory Versus Practice",
  recent_change: "Recent Change",
  unmet_need: "Unmet Need",
  innovation_orientation: "Innovation Orientation",
};

export const OBJECTIVE_FIELD_NAMES: Record<Objective, readonly string[]> = {
  current_issue: [
    "primary_current_issue",
    "secondary_current_issue",
    "status",
    "organizational_impact_described",
    "evidence_basis",
  ],
  enduring_concern: [
    "primary_enduring_concern",
    "why_it_persists",
    "main_barrier_to_resolution",
    "time_horizon",
  ],
  theory_vs_practice: [
    "principle_or_expectation",
    "practical_constraint",
    "competing_considerations",
    "consequence_of_the_tension",
    "concrete_example_provided",
  ],
  recent_change: [
    "change_identified",
    "type_of_change",
    "effect_on_work_or_decisions",
    "expected_duration",
  ],
  unmet_need: [
    "unmet_need",
    "type_of_support",
    "desired_outcome",
    "potential_gfoa_role",
  ],
  innovation_orientation: [
    "primary_attention_trigger",
    "principal_source_of_assurance",
    "principal_source_of_caution",
    "role_of_peer_evidence",
    "preferred_adoption_posture",
  ],
};

export const COVERAGE_VALUES = [
  "sufficiently_covered",
  "partially_covered",
  "not_covered",
  "unclear",
] as const;

export const CONFIDENCE_VALUES = ["high", "moderate", "low"] as const;

export const OVERALL_QUALITY_VALUES = [
  "strong",
  "adequate",
  "limited",
  "unusable",
] as const;
