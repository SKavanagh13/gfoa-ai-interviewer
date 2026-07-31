import { describe, expect, it } from "vitest";
import {
  findExactQuoteInTranscript,
  normalizeForExactMatch,
} from "@/lib/transcript/quote-matching";
import type { CanonicalTranscriptSegment } from "@/lib/transcript/types";

function transcriptSegment(
  overrides: Partial<CanonicalTranscriptSegment>,
): CanonicalTranscriptSegment {
  return {
    segmentId: "segment-1",
    interviewId: "interview-1",
    sequenceNumber: 1,
    speaker: "participant",
    text: "The revenue forecast changed very quickly this spring.",
    startTimeMs: 0,
    endTimeMs: 1000,
    providerEventId: "event-1",
    isFinal: true,
    ...overrides,
  };
}

describe("quote matching utilities", () => {
  it("normalizes case and whitespace while preserving punctuation", () => {
    expect(normalizeForExactMatch("  The\tForecast\nChanged.  ")).toBe(
      "the forecast changed.",
    );
  });

  it("matches case variation in canonical segment text", () => {
    expect(
      findExactQuoteInTranscript(
        [transcriptSegment({})],
        "REVENUE forecast CHANGED",
      ),
    ).toMatchObject({
      status: "match",
      sourceSegmentIds: ["segment-1"],
    });
  });

  it("matches whitespace variation in canonical segment text", () => {
    expect(
      findExactQuoteInTranscript(
        [transcriptSegment({ text: "We need  better\n tools for planning." })],
        "need better tools",
      ),
    ).toMatchObject({
      status: "match",
      spans: [
        {
          segmentId: "segment-1",
          startOffset: 3,
          endOffset: 22,
        },
      ],
    });
  });

  it("rejects paraphrases", () => {
    expect(
      findExactQuoteInTranscript(
        [transcriptSegment({})],
        "Revenue estimates are changing fast.",
      ),
    ).toEqual({
      status: "no_match",
      quoteText: "Revenue estimates are changing fast.",
      reason: "not_found",
    });
  });

  it("does not match against serialized transcript prefixes or speaker labels", () => {
    expect(
      findExactQuoteInTranscript([transcriptSegment({})], "[0001] participant"),
    ).toEqual({
      status: "no_match",
      quoteText: "[0001] participant",
      reason: "not_found",
    });
  });

  it("returns invalid transcript instead of treating a quote as verified", () => {
    expect(
      findExactQuoteInTranscript(
        [transcriptSegment({ isFinal: false })],
        "revenue forecast",
      ),
    ).toMatchObject({
      status: "no_match",
      reason: "invalid_transcript",
    });
  });

  it("rejects blank proposed quote text", () => {
    expect(findExactQuoteInTranscript([transcriptSegment({})], "  ")).toEqual({
      status: "no_match",
      quoteText: "  ",
      reason: "blank_quote",
    });
  });
});
