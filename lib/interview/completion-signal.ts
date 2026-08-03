export const COMPLETED_INTERVIEW_CLOSING_SENTENCE =
  "Thank you for your time today. Please select End interview to conclude our time together.";

export function containsCompletedInterviewClosing(text: string): boolean {
  return normalizeForCompletionSignal(text).endsWith(
    normalizeForCompletionSignal(COMPLETED_INTERVIEW_CLOSING_SENTENCE),
  );
}

function normalizeForCompletionSignal(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}
