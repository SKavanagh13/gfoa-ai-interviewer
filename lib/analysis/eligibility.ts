import { validateTranscriptForCanonicalUse } from "@/lib/transcript/canonical";
import type { CanonicalTranscriptSegment } from "@/lib/transcript/types";
import {
  countParticipantWords,
  validateEligibilityModelResult,
} from "@/lib/analysis/output-validation";
import type { EligibilityModelResult } from "@/lib/analysis/types";

export type DeterministicEligibilityResult =
  | { status: "word_count_failed"; participantWordCount: number }
  | { status: "classifier_required"; participantWordCount: number };

export type EligibilityDecision =
  | {
      eligible: true;
      participantWordCount: number;
      supportingObjective: NonNullable<EligibilityModelResult["supporting_objective"]>;
      supportingSegmentIds: string[];
      rationale: string;
    }
  | {
      eligible: false;
      participantWordCount: number;
      supportingObjective: null;
      supportingSegmentIds: string[];
      rationale: string;
    };

export function evaluateDeterministicEligibility(
  segments: readonly CanonicalTranscriptSegment[],
): DeterministicEligibilityResult {
  const validation = validateTranscriptForCanonicalUse(segments);

  if (!validation.ok) {
    return { status: "word_count_failed", participantWordCount: 0 };
  }

  const participantWordCount = countParticipantWords(validation.orderedSegments);

  if (participantWordCount < 40) {
    return { status: "word_count_failed", participantWordCount };
  }

  return { status: "classifier_required", participantWordCount };
}

export function decideEligibilityFromClassifier(
  classifierOutput: unknown,
  segments: readonly CanonicalTranscriptSegment[],
  participantWordCount: number,
): EligibilityDecision {
  const validation = validateEligibilityModelResult(classifierOutput, segments);

  if (
    !validation.ok ||
    !validation.result.eligible ||
    !validation.result.supporting_objective
  ) {
    return {
      eligible: false,
      participantWordCount,
      supportingObjective: null,
      supportingSegmentIds: [],
      rationale: validation.ok ? validation.result.rationale : validation.errorMessage,
    };
  }

  return {
    eligible: true,
    participantWordCount,
    supportingObjective: validation.result.supporting_objective,
    supportingSegmentIds: validation.result.supporting_segment_ids,
    rationale: validation.result.rationale,
  };
}
