import {
  CONFIDENCE_VALUES,
  COVERAGE_VALUES,
  OBJECTIVE_FIELD_NAMES,
  OBJECTIVES,
  OVERALL_QUALITY_VALUES,
  type Objective,
} from "@/lib/analysis/constants";
import type {
  AnalysisObjectiveResult,
  EligibilityModelResult,
  PostInterviewOutput,
  RepresentativeQuoteProposal,
  StructuredField,
  TopicTag,
} from "@/lib/analysis/types";
import type { CanonicalTranscriptSegment } from "@/lib/transcript/types";

export type AnalysisValidationResult =
  | { ok: true; output: PostInterviewOutput }
  | { ok: false; issues: string[]; errorMessage: string };

export type EligibilityValidationResult =
  | { ok: true; result: EligibilityModelResult }
  | { ok: false; issues: string[]; errorMessage: string };

export function validatePostInterviewOutput(
  value: unknown,
  segments: readonly CanonicalTranscriptSegment[],
): AnalysisValidationResult {
  const issues: string[] = [];

  if (!isRecord(value)) {
    return failure(["Output must be an object."]);
  }

  const output = value as PostInterviewOutput;
  validateOverview(output.overview, issues);
  validateObjectiveResults(output.objective_results, segments, issues);
  validateCrossCuttingThemes(output.cross_cutting_themes, segments, issues);
  validateTopicTags(output.topic_tags, segments, issues);
  validateQuoteProposals(output.representative_quotes, segments, issues);

  if (!OVERALL_QUALITY_VALUES.includes(output.overall_quality)) {
    issues.push("overall_quality must be an allowed value.");
  }

  if (output.limitations !== null && typeof output.limitations !== "string") {
    issues.push("limitations must be a string or null.");
  }

  if (
    output.negative_reaction_flag !== null &&
    typeof output.negative_reaction_flag !== "boolean"
  ) {
    issues.push("negative_reaction_flag must be a boolean or null.");
  }

  if (issues.length > 0) {
    return failure(issues);
  }

  return { ok: true, output };
}

export function validateEligibilityModelResult(
  value: unknown,
  segments: readonly CanonicalTranscriptSegment[],
): EligibilityValidationResult {
  const issues: string[] = [];

  if (!isRecord(value)) {
    return eligibilityFailure(["Eligibility output must be an object."]);
  }

  const result = value as EligibilityModelResult;

  if (typeof result.eligible !== "boolean") {
    issues.push("eligible must be a boolean.");
  }

  if (
    result.supporting_objective !== null &&
    !OBJECTIVES.includes(result.supporting_objective)
  ) {
    issues.push("supporting_objective must be a locked objective or null.");
  }

  if (!Array.isArray(result.supporting_segment_ids)) {
    issues.push("supporting_segment_ids must be an array.");
  } else {
    validateSegmentIds(
      result.supporting_segment_ids,
      segments,
      "eligibility supporting_segment_ids",
      issues,
    );
  }

  if (typeof result.rationale !== "string" || !result.rationale.trim()) {
    issues.push("rationale must be a non-empty string.");
  }

  if (result.eligible) {
    if (!result.supporting_objective) {
      issues.push("eligible result must cite a supporting objective.");
    }
    if (
      !Array.isArray(result.supporting_segment_ids) ||
      result.supporting_segment_ids.length === 0
    ) {
      issues.push("eligible result must cite supporting segments.");
    }
  }

  if (issues.length > 0) {
    return eligibilityFailure(issues);
  }

  return { ok: true, result };
}

export function countParticipantWords(
  segments: readonly CanonicalTranscriptSegment[],
): number {
  return segments
    .filter((segment) => segment.speaker === "participant" && segment.isFinal)
    .reduce((count, segment) => count + countWords(segment.text), 0);
}

function validateOverview(value: unknown, issues: string[]) {
  if (!isRecord(value)) {
    issues.push("overview must be an object.");
    return;
  }

  for (const key of [
    "overall_summary",
    "primary_takeaway",
    "notable_additional_issue",
  ] as const) {
    if (typeof value[key] !== "string" || !value[key].trim()) {
      issues.push(`overview.${key} must be a non-empty string.`);
    }
  }
}

function validateObjectiveResults(
  value: unknown,
  segments: readonly CanonicalTranscriptSegment[],
  issues: string[],
) {
  if (!Array.isArray(value)) {
    issues.push("objective_results must be an array.");
    return;
  }

  if (value.length !== OBJECTIVES.length) {
    issues.push("objective_results must contain exactly six rows.");
  }

  const seen = new Set<Objective>();

  for (const item of value) {
    validateObjectiveResult(item, segments, seen, issues);
  }

  for (const objective of OBJECTIVES) {
    if (!seen.has(objective)) {
      issues.push(`Missing objective result for ${objective}.`);
    }
  }
}

function validateObjectiveResult(
  value: unknown,
  segments: readonly CanonicalTranscriptSegment[],
  seen: Set<Objective>,
  issues: string[],
) {
  if (!isRecord(value)) {
    issues.push("objective result must be an object.");
    return;
  }

  const result = value as AnalysisObjectiveResult;

  if (!OBJECTIVES.includes(result.objective)) {
    issues.push("objective result has an unknown objective.");
    return;
  }

  if (seen.has(result.objective)) {
    issues.push(`Duplicate objective result for ${result.objective}.`);
  }
  seen.add(result.objective);

  if (typeof result.narrative_summary !== "string" || !result.narrative_summary.trim()) {
    issues.push(`${result.objective} narrative_summary must be non-empty.`);
  }

  if (!COVERAGE_VALUES.includes(result.coverage)) {
    issues.push(`${result.objective} coverage must be allowed.`);
  }

  if (!CONFIDENCE_VALUES.includes(result.confidence)) {
    issues.push(`${result.objective} confidence must be allowed.`);
  }

  validateStructuredFields(result, issues);

  if (!Array.isArray(result.supporting_segment_ids)) {
    issues.push(`${result.objective} supporting_segment_ids must be an array.`);
  } else {
    validateSegmentIds(
      result.supporting_segment_ids,
      segments,
      `${result.objective} supporting_segment_ids`,
      issues,
    );

    if (
      result.coverage !== "not_covered" &&
      result.coverage !== "unclear" &&
      result.supporting_segment_ids.length === 0
    ) {
      issues.push(`${result.objective} substantive coverage requires evidence.`);
    }
  }
}

function validateStructuredFields(
  result: AnalysisObjectiveResult,
  issues: string[],
) {
  if (!Array.isArray(result.structured_fields)) {
    issues.push(`${result.objective} structured_fields must be an array.`);
    return;
  }

  const allowedNames = new Set(OBJECTIVE_FIELD_NAMES[result.objective]);
  const seenNames = new Set<string>();

  for (const field of result.structured_fields as StructuredField[]) {
    if (!isRecord(field)) {
      issues.push(`${result.objective} structured field must be an object.`);
      continue;
    }

    if (!allowedNames.has(field.field_name)) {
      issues.push(`${result.objective} has unsupported field ${field.field_name}.`);
    }

    if (seenNames.has(field.field_name)) {
      issues.push(`${result.objective} duplicates field ${field.field_name}.`);
    }
    seenNames.add(field.field_name);

    if (!["supported", "not_discussed", "unclear"].includes(field.value_status)) {
      issues.push(`${result.objective}.${field.field_name} value_status is invalid.`);
    }

    if (field.value !== null && typeof field.value !== "string") {
      issues.push(`${result.objective}.${field.field_name} value must be string or null.`);
    }

    if (field.value_status !== "supported" && field.value !== null) {
      issues.push(
        `${result.objective}.${field.field_name} unsupported values must be null.`,
      );
    }
  }
}

function validateCrossCuttingThemes(
  value: unknown,
  segments: readonly CanonicalTranscriptSegment[],
  issues: string[],
) {
  if (!isRecord(value)) {
    issues.push("cross_cutting_themes must be an object.");
    return;
  }

  for (const key of [
    "key_tension",
    "recurring_concern",
    "opportunity_signal",
    "emerging_signal",
  ] as const) {
    if (typeof value[key] !== "string" || !value[key].trim()) {
      issues.push(`cross_cutting_themes.${key} must be a non-empty string.`);
    }
  }

  void segments;
}

function validateTopicTags(
  value: unknown,
  segments: readonly CanonicalTranscriptSegment[],
  issues: string[],
) {
  if (!Array.isArray(value)) {
    issues.push("topic_tags must be an array.");
    return;
  }

  if (value.length > 5) {
    issues.push("topic_tags must include no more than five labels.");
  }

  for (const item of value as TopicTag[]) {
    if (!isRecord(item)) {
      issues.push("topic tag must be an object.");
      continue;
    }

    if (typeof item.label !== "string" || !item.label.trim()) {
      issues.push("topic tag label must be non-empty.");
    }

    if (!["primary", "secondary"].includes(item.importance)) {
      issues.push("topic tag importance must be primary or secondary.");
    }

    validateSegmentIds(
      item.supporting_segment_ids,
      segments,
      `topic tag ${item.label} supporting_segment_ids`,
      issues,
    );
  }
}

function validateQuoteProposals(
  value: unknown,
  segments: readonly CanonicalTranscriptSegment[],
  issues: string[],
) {
  if (!Array.isArray(value)) {
    issues.push("representative_quotes must be an array.");
    return;
  }

  if (value.length > 3) {
    issues.push("representative_quotes must include no more than three quotes.");
  }

  for (const quote of value as RepresentativeQuoteProposal[]) {
    if (!isRecord(quote)) {
      issues.push("representative quote must be an object.");
      continue;
    }

    if (typeof quote.quote_text !== "string" || !quote.quote_text.trim()) {
      issues.push("representative quote text must be non-empty.");
    }

    if (quote.related_objective !== null && !OBJECTIVES.includes(quote.related_objective)) {
      issues.push("representative quote related_objective is invalid.");
    }

    if (typeof quote.reason_selected !== "string") {
      issues.push("representative quote reason_selected must be a string.");
    }

    validateSegmentIds(
      quote.proposed_segment_ids,
      segments,
      `quote ${quote.quote_text} proposed_segment_ids`,
      issues,
    );
  }
}

function validateSegmentIds(
  value: unknown,
  segments: readonly CanonicalTranscriptSegment[],
  label: string,
  issues: string[],
) {
  if (!Array.isArray(value)) {
    issues.push(`${label} must be an array.`);
    return;
  }

  const bySegmentId = new Map(
    segments.map((segment) => [segment.segmentId, segment]),
  );

  for (const segmentId of value) {
    if (typeof segmentId !== "string" || !segmentId.trim()) {
      issues.push(`${label} contains an invalid segment ID.`);
      continue;
    }

    const segment = bySegmentId.get(segmentId);
    if (!segment) {
      issues.push(`${label} cites segment ${segmentId}, which does not exist.`);
      continue;
    }

    if (!segment.isFinal) {
      issues.push(`${label} cites non-final segment ${segmentId}.`);
    }
  }
}

function countWords(text: string): number {
  return text.trim().split(/\s+/u).filter(Boolean).length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function failure(issues: string[]): AnalysisValidationResult {
  return {
    ok: false,
    issues,
    errorMessage: `Post-interview output validation failed: ${issues.join(" ")}`,
  };
}

function eligibilityFailure(issues: string[]): EligibilityValidationResult {
  return {
    ok: false,
    issues,
    errorMessage: `Eligibility validation failed: ${issues.join(" ")}`,
  };
}
