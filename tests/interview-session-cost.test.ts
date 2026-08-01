import { describe, expect, it } from "vitest";
import { InterviewSessionRepository } from "@/lib/interview/session-repository";

function createInterviewSupabase(initial: {
  estimated_input_tokens: number | null;
  estimated_output_tokens: number | null;
}) {
  const state = { ...initial };
  const updates: Array<Record<string, unknown>> = [];

  return {
    state,
    updates,
    client: {
      from(table: string) {
        expect(table).toBe("interviews");
        return {
          select() {
            return {
              eq() {
                return {
                  async single() {
                    return { data: state, error: null };
                  },
                };
              },
            };
          },
          update(values: Record<string, unknown>) {
            updates.push(values);
            Object.assign(state, values);
            return {
              eq() {
                return {
                  is() {
                    return {
                      neq() {
                        return { error: null };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      },
    },
  };
}

describe("interview session cost recording", () => {
  it("sums sideband usage and stores live and total estimated cost", async () => {
    const fake = createInterviewSupabase({
      estimated_input_tokens: 1_000,
      estimated_output_tokens: 500,
    });
    const repository = new InterviewSessionRepository(
      fake.client as never,
      "participant-secret",
      "gpt-realtime",
    );

    await repository.recordUsage("interview-1", {
      inputTokens: 9_000,
      outputTokens: 4_500,
    });

    expect(fake.updates[0]).toMatchObject({
      estimated_input_tokens: 10_000,
      estimated_output_tokens: 5_000,
      estimated_live_cost_usd: 0.64,
      estimated_total_cost_usd: 0.64,
    });
  });

  it("classifies completed and abandoned terminal session costs", async () => {
    const completed = createInterviewSupabase({
      estimated_input_tokens: null,
      estimated_output_tokens: null,
    });
    const completedRepository = new InterviewSessionRepository(
      completed.client as never,
      "participant-secret",
      "gpt-realtime",
    );

    await completedRepository.markCompleted("interview-1");
    expect(completed.updates[0]).toMatchObject({
      end_disposition: "completed",
      cost_category: "completed",
    });

    const abandoned = createInterviewSupabase({
      estimated_input_tokens: null,
      estimated_output_tokens: null,
    });
    const abandonedRepository = new InterviewSessionRepository(
      abandoned.client as never,
      "participant-secret",
      "gpt-realtime",
    );

    await abandonedRepository.markParticipantEnded("interview-1");
    expect(abandoned.updates.at(-1)).toMatchObject({
      end_disposition: "participant_ended",
      cost_category: "abandoned",
    });
  });
});
