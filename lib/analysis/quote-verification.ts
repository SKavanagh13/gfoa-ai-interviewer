import { findExactQuoteInTranscript } from "@/lib/transcript/quote-matching";
import type { CanonicalTranscriptSegment } from "@/lib/transcript/types";
import type { RepresentativeQuoteProposal } from "@/lib/analysis/types";

export type VerifiedQuoteForPersistence = {
  quote_text: string;
  objective: RepresentativeQuoteProposal["related_objective"];
  reason_selected: string;
  verification_status: "accepted" | "rejected";
  source_segment_ids: string[];
  spans: Array<{
    segment_id: string;
    start_offset: number;
    end_offset: number;
  }>;
};

export function verifyQuoteProposals(
  proposals: readonly RepresentativeQuoteProposal[],
  segments: readonly CanonicalTranscriptSegment[],
): VerifiedQuoteForPersistence[] {
  return proposals.map((proposal) => {
    const match = findExactQuoteInTranscript(segments, proposal.quote_text);

    if (match.status !== "match") {
      return {
        quote_text: proposal.quote_text,
        objective: proposal.related_objective,
        reason_selected: proposal.reason_selected,
        verification_status: "rejected",
        source_segment_ids: [],
        spans: [],
      };
    }

    return {
      quote_text: proposal.quote_text,
      objective: proposal.related_objective,
      reason_selected: proposal.reason_selected,
      verification_status: "accepted",
      source_segment_ids: match.sourceSegmentIds,
      spans: match.spans.map((span) => ({
        segment_id: span.segmentId,
        start_offset: span.startOffset,
        end_offset: span.endOffset,
      })),
    };
  });
}
