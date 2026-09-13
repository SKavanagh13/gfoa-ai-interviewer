import { describe, expect, it } from "vitest";
import { buildSegmentMap } from "@/lib/analysis/repository";
import type { CanonicalTranscriptSegment } from "@/lib/transcript/types";

function segment(
  sequenceNumber: number,
  segmentId: string,
): CanonicalTranscriptSegment {
  return {
    segmentId,
    interviewId: "interview-1",
    sequenceNumber,
    speaker: "participant",
    text: "A finalized transcript segment.",
    startTimeMs: 0,
    endTimeMs: 1000,
    providerEventId: `event-${sequenceNumber}`,
    isFinal: true,
  };
}

describe("Wave 5 analysis segment map", () => {
  it("maps transcript labels to canonical segment IDs for model citations", () => {
    expect(
      buildSegmentMap([
        segment(6, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
        segment(8, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
      ]),
    ).toBe(
      [
        "transcript_label=[0006] | segment_id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa | speaker=participant | is_final=true",
        "transcript_label=[0008] | segment_id=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb | speaker=participant | is_final=true",
      ].join("\n"),
    );
  });
});
