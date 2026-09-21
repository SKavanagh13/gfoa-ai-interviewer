export const COMPLETED_INTERVIEW_CLOSING_SENTENCE =
  "Thank you for your time today. That is everything I wanted to ask. I will now end the interview. Have a great day.";

type RealtimeResponseEvent = {
  type?: unknown;
  response?: {
    output?: Array<{
      role?: unknown;
      content?: Array<{
        transcript?: unknown;
        text?: unknown;
      }>;
    }>;
  };
};

export function containsCompletedInterviewClosing(text: string): boolean {
  return normalizeForCompletionSignal(text).endsWith(
    normalizeForCompletionSignal(COMPLETED_INTERVIEW_CLOSING_SENTENCE),
  );
}

export function isCompletedInterviewClosingEvent(
  event: RealtimeResponseEvent,
): boolean {
  if (event.type !== "response.done") {
    return false;
  }

  return (event.response?.output ?? []).some(
    (item) =>
      item.role === "assistant" &&
      (item.content ?? []).some((content) => {
        const text =
          typeof content.transcript === "string"
            ? content.transcript
            : typeof content.text === "string"
              ? content.text
              : "";

        return containsCompletedInterviewClosing(text);
      }),
  );
}

function normalizeForCompletionSignal(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}
