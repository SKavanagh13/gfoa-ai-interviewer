import { validateTranscriptForCanonicalUse } from "@/lib/transcript/canonical";
import type { CanonicalTranscriptSegment } from "@/lib/transcript/types";

export type QuoteSourceSpan = {
  segmentId: string;
  startOffset: number;
  endOffset: number;
};

export type QuoteMatchResult =
  | {
      status: "match";
      quoteText: string;
      normalizedQuote: string;
      sourceSegmentIds: string[];
      spans: QuoteSourceSpan[];
    }
  | {
      status: "no_match";
      quoteText: string;
      reason: "blank_quote" | "invalid_transcript" | "not_found";
      validationError?: string;
    };

type NormalizedTextIndex = {
  normalizedText: string;
  originalOffsets: number[];
};

export function normalizeForExactMatch(text: string): string {
  return buildNormalizedTextIndex(text).normalizedText;
}

export function findExactQuoteInTranscript(
  segments: readonly CanonicalTranscriptSegment[],
  quoteText: string,
): QuoteMatchResult {
  const normalizedQuote = normalizeForExactMatch(quoteText);

  if (normalizedQuote.length === 0) {
    return {
      status: "no_match",
      quoteText,
      reason: "blank_quote",
    };
  }

  const validation = validateTranscriptForCanonicalUse(segments);

  if (!validation.ok) {
    return {
      status: "no_match",
      quoteText,
      reason: "invalid_transcript",
      validationError: validation.errorMessage,
    };
  }

  for (const segment of validation.orderedSegments) {
    const normalizedSegment = buildNormalizedTextIndex(segment.text);
    const matchStart = normalizedSegment.normalizedText.indexOf(normalizedQuote);

    if (matchStart === -1) {
      continue;
    }

    const matchEnd = matchStart + normalizedQuote.length - 1;
    const startOffset = normalizedSegment.originalOffsets[matchStart];
    const endOffset = normalizedSegment.originalOffsets[matchEnd] + 1;

    return {
      status: "match",
      quoteText,
      normalizedQuote,
      sourceSegmentIds: [segment.segmentId],
      spans: [
        {
          segmentId: segment.segmentId,
          startOffset,
          endOffset,
        },
      ],
    };
  }

  return {
    status: "no_match",
    quoteText,
    reason: "not_found",
  };
}

function buildNormalizedTextIndex(text: string): NormalizedTextIndex {
  let normalizedText = "";
  const originalOffsets: number[] = [];
  let pendingWhitespaceOffset: number | null = null;

  for (let index = 0; index < text.length; ) {
    const codePoint = text.codePointAt(index);

    if (codePoint === undefined) {
      break;
    }

    const rawChar = String.fromCodePoint(codePoint);
    const rawCharLength = rawChar.length;

    if (/\s/u.test(rawChar)) {
      if (pendingWhitespaceOffset === null) {
        pendingWhitespaceOffset = index;
      }
      index += rawCharLength;
      continue;
    }

    if (pendingWhitespaceOffset !== null && normalizedText.length > 0) {
      normalizedText += " ";
      originalOffsets.push(pendingWhitespaceOffset);
    }
    pendingWhitespaceOffset = null;

    const normalizedChar = rawChar.normalize("NFKC").toLowerCase();
    for (const outputChar of normalizedChar) {
      normalizedText += outputChar;
      originalOffsets.push(index);
    }

    index += rawCharLength;
  }

  return {
    normalizedText,
    originalOffsets,
  };
}
