import { describe, expect, it } from "vitest";
import { parseSidebandEvent } from "@/lib/interview/sideband-events";

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
