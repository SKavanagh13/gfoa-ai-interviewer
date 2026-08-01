import { describe, expect, it } from "vitest";
import { verifyQuoteProposals } from "@/lib/analysis/quote-verification";
import type { CanonicalTranscriptSegment } from "@/lib/transcript/types";

const transcript: CanonicalTranscriptSegment[] = [
  {
    segmentId: "segment-1",
    interviewId: "interview-1",
    sequenceNumber: 1,
    speaker: "participant",
    text: "We need clearer tools for explaining capital tradeoffs.",
    startTimeMs: 0,
    endTimeMs: 1000,
    providerEventId: "event-1",
    isFinal: true,
  },
];

describe("Wave 5 quote verification", () => {
  it("persists accepted source segment offsets for exact matches", () => {
    expect(
      verifyQuoteProposals(
        [
          {
            quote_text: "clearer tools",
            related_objective: "unmet_need",
            reason_selected: "Shows the desired support.",
            proposed_segment_ids: ["segment-1"],
          },
        ],
        transcript,
      ),
    ).toEqual([
      {
        quote_text: "clearer tools",
        objective: "unmet_need",
        reason_selected: "Shows the desired support.",
        verification_status: "accepted",
        source_segment_ids: ["segment-1"],
        spans: [
          {
            segment_id: "segment-1",
            start_offset: 8,
            end_offset: 21,
          },
        ],
      },
    ]);
  });

  it("retains non-matching proposals as rejected without offsets", () => {
    expect(
      verifyQuoteProposals(
        [
          {
            quote_text: "They need better capital planning software.",
            related_objective: "unmet_need",
            reason_selected: "Paraphrase should fail deterministic matching.",
            proposed_segment_ids: ["segment-1"],
          },
        ],
        transcript,
      )[0],
    ).toMatchObject({
      verification_status: "rejected",
      source_segment_ids: [],
      spans: [],
    });
  });
});
