import { describe, expect, it } from "vitest";
import { parseSidebandEvent } from "@/lib/interview/sideband-events";
import { COMPLETED_INTERVIEW_CLOSING_SENTENCE } from "@/lib/interview/completion-signal";

describe("sideband event parsing", () => {
  it("maps finalized input transcription to participant transcript segments", () => {
    expect(
      parseSidebandEvent({
        type: "conversation.item.input_audio_transcription.completed",
        event_id: "evt_user",
        transcript: "This is my answer.",
      }),
    ).toEqual([
      {
        kind: "transcript",
        segment: {
          speaker: "participant",
          text: "This is my answer.",
          providerEventId: "evt_user",
        },
      },
    ]);
  });

  it("maps response.done assistant transcripts and usage", () => {
    expect(
      parseSidebandEvent({
        type: "response.done",
        event_id: "evt_assistant",
        response: {
          status: "completed",
          usage: {
            input_tokens: 10,
            output_tokens: 20,
          },
          output: [
            {
              role: "assistant",
              content: [
                {
                  type: "output_audio",
                  transcript: "Thanks for sharing that.",
                },
              ],
            },
          ],
        },
      }),
    ).toContainEqual({
      kind: "usage",
      inputTokens: 10,
      outputTokens: 20,
    });
  });

  it("detects the normal completed-interview closing sentence in finalized assistant transcript", () => {
    expect(
      parseSidebandEvent({
        type: "response.done",
        event_id: "evt_assistant",
        response: {
          status: "completed",
          output: [
            {
              role: "assistant",
              content: [
                {
                  type: "output_audio",
                  transcript: `That covers the main themes. ${COMPLETED_INTERVIEW_CLOSING_SENTENCE}`,
                },
              ],
            },
          ],
        },
      }),
    ).toContainEqual({ kind: "completedClosing" });
  });

  it("does not mark generic thank-you text as a completed interview", () => {
    expect(
      parseSidebandEvent({
        type: "response.done",
        event_id: "evt_assistant",
        response: {
          status: "completed",
          output: [
            {
              role: "assistant",
              content: [
                {
                  type: "output_audio",
                  transcript: "Thanks for sharing that.",
                },
              ],
            },
          ],
        },
      }),
    ).not.toContainEqual({ kind: "completedClosing" });
  });

  it("does not mark a quoted closing sentence before the end of the response", () => {
    expect(
      parseSidebandEvent({
        type: "response.done",
        event_id: "evt_assistant",
        response: {
          status: "completed",
          output: [
            {
              role: "assistant",
              content: [
                {
                  type: "output_audio",
                  transcript: `I will close later with "${COMPLETED_INTERVIEW_CLOSING_SENTENCE}" after one more question.`,
                },
              ],
            },
          ],
        },
      }),
    ).not.toContainEqual({ kind: "completedClosing" });
  });

  it("does not treat ordinary output buffer stops as session endings", () => {
    expect(
      parseSidebandEvent({
        type: "output_audio_buffer.stopped",
      }),
    ).toEqual([{ kind: "ignore" }]);
  });

  it("maps the confirmed session-ended sentinel", () => {
    expect(
      parseSidebandEvent({
        type: "session.ended",
      }),
    ).toEqual([{ kind: "sessionEnded" }]);
  });
});
