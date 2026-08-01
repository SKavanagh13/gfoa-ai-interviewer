export const COMPLETED_INTERVIEW_CLOSING_SENTENCE =
  "Thank you for sharing your perspective with GFOA.";

export function containsCompletedInterviewClosing(text: string): boolean {
  return normalizeForCompletionSignal(text).endsWith(
    normalizeForCompletionSignal(COMPLETED_INTERVIEW_CLOSING_SENTENCE),
  );
}

function normalizeForCompletionSignal(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}
