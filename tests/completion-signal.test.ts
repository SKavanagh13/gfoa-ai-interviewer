import { describe, expect, it } from "vitest";
import {
  COMPLETED_INTERVIEW_CLOSING_SENTENCE,
  isCompletedInterviewClosingEvent,
} from "@/lib/interview/completion-signal";

describe("completed interview closing signal", () => {
  it("recognizes the approved closing in a finalized assistant response", () => {
    expect(
      isCompletedInterviewClosingEvent({
        type: "response.done",
        response: {
          output: [
            {
              role: "assistant",
              content: [
                {
                  transcript: `One final thought. ${COMPLETED_INTERVIEW_CLOSING_SENTENCE}`,
                },
              ],
            },
          ],
        },
      }),
    ).toBe(true);
  });

  it("does not treat ordinary assistant responses as completion", () => {
    expect(
      isCompletedInterviewClosingEvent({
        type: "response.done",
        response: {
          output: [
            {
              role: "assistant",
              content: [{ transcript: "Thanks for sharing that." }],
            },
          ],
        },
      }),
    ).toBe(false);
  });
});
