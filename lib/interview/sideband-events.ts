import type { FinalTranscriptSegment } from "@/lib/interview/session-repository";
import { containsCompletedInterviewClosing } from "@/lib/interview/completion-signal";

export type SidebandParsedEvent =
  | { kind: "transcript"; segment: FinalTranscriptSegment }
  | { kind: "usage"; inputTokens?: number; outputTokens?: number }
  | { kind: "completedClosing" }
  | { kind: "sessionEnded" }
  | { kind: "ignore" };

type RealtimeEvent = {
  type?: string;
  event_id?: string;
  transcript?: string;
  response?: {
    status?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
    };
    output?: Array<{
      role?: string;
      content?: Array<{
        type?: string;
        transcript?: string;
        text?: string;
      }>;
    }>;
  };
};

export function parseSidebandEvent(event: RealtimeEvent): SidebandParsedEvent[] {
  if (event.type === "conversation.item.input_audio_transcription.completed") {
    return [
      {
        kind: "transcript",
        segment: {
          speaker: "participant",
          text: event.transcript ?? "",
          providerEventId: event.event_id ?? null,
        },
      },
    ];
  }

  if (event.type === "response.done") {
    const parsed: SidebandParsedEvent[] = [];

    for (const item of event.response?.output ?? []) {
      if (item.role !== "assistant") {
        continue;
      }

      for (const content of item.content ?? []) {
        const text = content.transcript ?? content.text ?? "";

        if (text.trim()) {
          parsed.push({
            kind: "transcript",
            segment: {
              speaker: "interviewer",
              text,
              providerEventId: event.event_id ?? null,
            },
          });

          if (containsCompletedInterviewClosing(text)) {
            parsed.push({ kind: "completedClosing" });
          }
        }
      }
    }

    if (event.response?.usage) {
      parsed.push({
        kind: "usage",
        inputTokens: event.response.usage.input_tokens,
        outputTokens: event.response.usage.output_tokens,
      });
    }

    if (
      event.response?.status === "completed" ||
      event.response?.status === "cancelled" ||
      event.response?.status === "failed" ||
      event.response?.status === "incomplete"
    ) {
      parsed.push({ kind: "ignore" });
    }

    return parsed;
  }

  if (event.type === "session.ended") {
    return [{ kind: "sessionEnded" }];
  }

  return [{ kind: "ignore" }];
}
