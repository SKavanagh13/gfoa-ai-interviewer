import type { CanonicalTranscriptSegment } from "@/lib/transcript/types";

export type TranscriptValidationIssueCode =
  | "empty_transcript"
  | "mixed_interview_ids"
  | "non_final_segment"
  | "blank_segment_text"
  | "invalid_sequence_number"
  | "duplicate_sequence_number"
  | "missing_sequence_number"
  | "duplicate_provider_event_id"
  | "invalid_timestamp_order";

export type TranscriptValidationIssue = {
  code: TranscriptValidationIssueCode;
  message: string;
  segmentIds?: string[];
  sequenceNumber?: number;
  providerEventId?: string;
};

export type TranscriptValidationResult =
  | {
      ok: true;
      orderedSegments: CanonicalTranscriptSegment[];
    }
  | {
      ok: false;
      issues: TranscriptValidationIssue[];
      errorMessage: string;
    };

export class TranscriptValidationError extends Error {
  constructor(
    message: string,
    readonly issues: TranscriptValidationIssue[],
  ) {
    super(message);
    this.name = "TranscriptValidationError";
  }
}

export function orderTranscriptSegments(
  segments: readonly CanonicalTranscriptSegment[],
): CanonicalTranscriptSegment[] {
  return [...segments].sort((a, b) => {
    if (a.sequenceNumber !== b.sequenceNumber) {
      return a.sequenceNumber - b.sequenceNumber;
    }

    return a.segmentId.localeCompare(b.segmentId);
  });
}

export function validateTranscriptForCanonicalUse(
  segments: readonly CanonicalTranscriptSegment[],
): TranscriptValidationResult {
  const orderedSegments = orderTranscriptSegments(segments);
  const issues: TranscriptValidationIssue[] = [];

  if (orderedSegments.length === 0) {
    issues.push({
      code: "empty_transcript",
      message: "Canonical transcript has no segments.",
    });
  }

  collectMixedInterviewIdIssues(orderedSegments, issues);
  collectPerSegmentIssues(orderedSegments, issues);
  collectDuplicateSequenceIssues(orderedSegments, issues);
  collectMissingSequenceIssues(orderedSegments, issues);
  collectDuplicateProviderEventIssues(orderedSegments, issues);

  if (issues.length > 0) {
    return {
      ok: false,
      issues,
      errorMessage: summarizeValidationIssues(issues),
    };
  }

  return { ok: true, orderedSegments };
}

export function serializeTranscript(
  segments: readonly CanonicalTranscriptSegment[],
): string {
  const validation = validateTranscriptForCanonicalUse(segments);

  if (!validation.ok) {
    throw new TranscriptValidationError(
      validation.errorMessage,
      validation.issues,
    );
  }

  return validation.orderedSegments
    .map(
      (segment) =>
        `[${segment.sequenceNumber.toString().padStart(4, "0")}] ${segment.speaker}: ${segment.text}`,
    )
    .join("\n");
}

function collectMixedInterviewIdIssues(
  segments: readonly CanonicalTranscriptSegment[],
  issues: TranscriptValidationIssue[],
) {
  const interviewIds = new Set(segments.map((segment) => segment.interviewId));

  if (interviewIds.size > 1) {
    issues.push({
      code: "mixed_interview_ids",
      message: "Canonical transcript input contains segments from multiple interviews.",
      segmentIds: segments.map((segment) => segment.segmentId),
    });
  }
}

function collectPerSegmentIssues(
  segments: readonly CanonicalTranscriptSegment[],
  issues: TranscriptValidationIssue[],
) {
  for (const segment of segments) {
    if (!segment.isFinal) {
      issues.push({
        code: "non_final_segment",
        message: `Segment ${segment.segmentId} is not final.`,
        segmentIds: [segment.segmentId],
        sequenceNumber: segment.sequenceNumber,
      });
    }

    if (segment.text.trim().length === 0) {
      issues.push({
        code: "blank_segment_text",
        message: `Segment ${segment.segmentId} has blank text.`,
        segmentIds: [segment.segmentId],
        sequenceNumber: segment.sequenceNumber,
      });
    }

    if (
      !Number.isInteger(segment.sequenceNumber) ||
      segment.sequenceNumber < 1
    ) {
      issues.push({
        code: "invalid_sequence_number",
        message: `Segment ${segment.segmentId} has invalid sequence number ${segment.sequenceNumber}.`,
        segmentIds: [segment.segmentId],
        sequenceNumber: segment.sequenceNumber,
      });
    }

    if (
      (segment.startTimeMs !== null && segment.startTimeMs < 0) ||
      (segment.endTimeMs !== null && segment.endTimeMs < 0) ||
      (segment.startTimeMs !== null &&
        segment.endTimeMs !== null &&
        segment.endTimeMs < segment.startTimeMs)
    ) {
      issues.push({
        code: "invalid_timestamp_order",
        message: `Segment ${segment.segmentId} has invalid transcript timestamps.`,
        segmentIds: [segment.segmentId],
        sequenceNumber: segment.sequenceNumber,
      });
    }
  }
}

function collectDuplicateSequenceIssues(
  segments: readonly CanonicalTranscriptSegment[],
  issues: TranscriptValidationIssue[],
) {
  const bySequenceNumber = new Map<number, CanonicalTranscriptSegment[]>();

  for (const segment of segments) {
    const existing = bySequenceNumber.get(segment.sequenceNumber) ?? [];
    existing.push(segment);
    bySequenceNumber.set(segment.sequenceNumber, existing);
  }

  for (const [sequenceNumber, matchingSegments] of bySequenceNumber) {
    if (matchingSegments.length > 1) {
      issues.push({
        code: "duplicate_sequence_number",
        message: `Sequence number ${sequenceNumber} appears more than once.`,
        segmentIds: matchingSegments.map((segment) => segment.segmentId),
        sequenceNumber,
      });
    }
  }
}

function collectMissingSequenceIssues(
  segments: readonly CanonicalTranscriptSegment[],
  issues: TranscriptValidationIssue[],
) {
  const validSequenceNumbers = new Set(
    segments
      .map((segment) => segment.sequenceNumber)
      .filter(
        (sequenceNumber) =>
          Number.isInteger(sequenceNumber) && sequenceNumber >= 1,
      ),
  );

  if (validSequenceNumbers.size === 0) {
    return;
  }

  const maxSequenceNumber = Math.max(...validSequenceNumbers);

  for (let sequenceNumber = 1; sequenceNumber <= maxSequenceNumber; sequenceNumber += 1) {
    if (!validSequenceNumbers.has(sequenceNumber)) {
      issues.push({
        code: "missing_sequence_number",
        message: `Sequence number ${sequenceNumber} is missing.`,
        sequenceNumber,
      });
    }
  }
}

function collectDuplicateProviderEventIssues(
  segments: readonly CanonicalTranscriptSegment[],
  issues: TranscriptValidationIssue[],
) {
  const byProviderEventId = new Map<string, CanonicalTranscriptSegment[]>();

  for (const segment of segments) {
    if (!segment.providerEventId) {
      continue;
    }

    const existing = byProviderEventId.get(segment.providerEventId) ?? [];
    existing.push(segment);
    byProviderEventId.set(segment.providerEventId, existing);
  }

  for (const [providerEventId, matchingSegments] of byProviderEventId) {
    if (matchingSegments.length > 1) {
      issues.push({
        code: "duplicate_provider_event_id",
        message: `Provider event ${providerEventId} appears more than once.`,
        segmentIds: matchingSegments.map((segment) => segment.segmentId),
        providerEventId,
      });
    }
  }
}

function summarizeValidationIssues(
  issues: readonly TranscriptValidationIssue[],
): string {
  return `Canonical transcript validation failed: ${issues
    .map((issue) => issue.message)
    .join(" ")}`;
}
