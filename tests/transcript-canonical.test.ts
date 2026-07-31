import { describe, expect, it } from "vitest";
import {
  orderTranscriptSegments,
  serializeTranscript,
  validateTranscriptForCanonicalUse,
} from "@/lib/transcript/canonical";
import type { CanonicalTranscriptSegment } from "@/lib/transcript/types";

const baseSegment: CanonicalTranscriptSegment = {
  segmentId: "segment-1",
  interviewId: "interview-1",
  sequenceNumber: 1,
  speaker: "participant",
  text: "Budgets are getting harder to explain.",
  startTimeMs: 0,
  endTimeMs: 1200,
  providerEventId: "event-1",
  isFinal: true,
};

function segment(
  overrides: Partial<CanonicalTranscriptSegment>,
): CanonicalTranscriptSegment {
  return {
    ...baseSegment,
    segmentId: overrides.segmentId ?? `segment-${overrides.sequenceNumber ?? 1}`,
    providerEventId:
      overrides.providerEventId === undefined
        ? `event-${overrides.sequenceNumber ?? 1}`
        : overrides.providerEventId,
    ...overrides,
  };
}

function issueCodes(segments: CanonicalTranscriptSegment[]) {
  const validation = validateTranscriptForCanonicalUse(segments);

  if (validation.ok) {
    return [];
  }

  return validation.issues.map((issue) => issue.code);
}

describe("canonical transcript utilities", () => {
  it("orders transcript segments deterministically without mutating input", () => {
    const unordered = [
      segment({ sequenceNumber: 2, text: "Second." }),
      segment({ sequenceNumber: 1, text: "First." }),
    ];

    expect(orderTranscriptSegments(unordered).map((item) => item.text)).toEqual([
      "First.",
      "Second.",
    ]);
    expect(unordered.map((item) => item.text)).toEqual(["Second.", "First."]);
  });

  it("serializes valid final segments in the stable canonical format", () => {
    expect(
      serializeTranscript([
        segment({ sequenceNumber: 2, speaker: "interviewer", text: "What changed?" }),
        segment({
          sequenceNumber: 1,
          speaker: "participant",
          text: "The timeline compressed.",
        }),
      ]),
    ).toBe(
      [
        "[0001] participant: The timeline compressed.",
        "[0002] interviewer: What changed?",
      ].join("\n"),
    );
  });

  it("passes validation for well-formed final segments", () => {
    expect(
      validateTranscriptForCanonicalUse([
        segment({ sequenceNumber: 1 }),
        segment({ sequenceNumber: 2 }),
      ]),
    ).toMatchObject({ ok: true });
  });

  it("rejects empty transcripts", () => {
    expect(issueCodes([])).toContain("empty_transcript");
  });

  it("rejects non-final segments", () => {
    expect(issueCodes([segment({ isFinal: false })])).toContain(
      "non_final_segment",
    );
  });

  it("rejects blank segment text", () => {
    expect(issueCodes([segment({ text: "   " })])).toContain(
      "blank_segment_text",
    );
  });

  it("rejects invalid, duplicate, and missing sequence numbers", () => {
    expect(issueCodes([segment({ sequenceNumber: 0 })])).toContain(
      "invalid_sequence_number",
    );
    expect(
      issueCodes([
        segment({ segmentId: "a", sequenceNumber: 1 }),
        segment({ segmentId: "b", sequenceNumber: 1 }),
      ]),
    ).toContain("duplicate_sequence_number");
    expect(
      issueCodes([
        segment({ sequenceNumber: 1 }),
        segment({ sequenceNumber: 3 }),
      ]),
    ).toContain("missing_sequence_number");
  });

  it("rejects duplicate non-null provider event IDs", () => {
    expect(
      issueCodes([
        segment({ sequenceNumber: 1, providerEventId: "provider-event" }),
        segment({ sequenceNumber: 2, providerEventId: "provider-event" }),
      ]),
    ).toContain("duplicate_provider_event_id");
  });

  it("rejects mixed interview IDs", () => {
    expect(
      issueCodes([
        segment({ sequenceNumber: 1, interviewId: "interview-1" }),
        segment({ sequenceNumber: 2, interviewId: "interview-2" }),
      ]),
    ).toContain("mixed_interview_ids");
  });

  it("rejects invalid timestamp ordering", () => {
    expect(
      issueCodes([segment({ startTimeMs: 200, endTimeMs: 100 })]),
    ).toContain("invalid_timestamp_order");
  });

  it("does not serialize invalid transcripts", () => {
    expect(() => serializeTranscript([segment({ isFinal: false })])).toThrow(
      "Canonical transcript validation failed",
    );
  });
});
