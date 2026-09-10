import { afterEach, describe, expect, it, vi } from "vitest";
import { InterviewSessionRepository } from "@/lib/interview/session-repository";

vi.mock("server-only", () => ({}));

const stableSegment = {
  segment_id: "segment-1",
  interview_id: "interview-1",
  sequence_number: 1,
  speaker: "participant",
  text: "This is a finalized participant segment.",
  start_time_ms: 0,
  end_time_ms: 1000,
  provider_event_id: "event-1",
  is_final: true,
};

function createSupabaseForStableTranscript(input: {
  existingPendingRun?: { analysis_id: string };
  insertError?: { message: string } | null;
  segments?: Array<typeof stableSegment>;
}) {
  const updates: Array<Record<string, unknown>> = [];
  const inserts: Array<Record<string, unknown>> = [];
  const queriedTables: string[] = [];

  const client = {
    from(table: string) {
      queriedTables.push(table);

      if (table === "transcript_segments") {
        return {
          select() {
            return {
              eq() {
                return {
                  async order() {
                    return {
                      data: input.segments ?? [stableSegment],
                      error: null,
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (table === "interviews") {
        return {
          update(values: Record<string, unknown>) {
            updates.push(values);
            return {
              async eq() {
                return { error: null };
              },
            };
          },
        };
      }

      if (table === "analysis_runs") {
        return {
          select() {
            return {
              eq() {
                return this;
              },
              order() {
                return this;
              },
              limit() {
                return this;
              },
              async maybeSingle() {
                return {
                  data: input.existingPendingRun
                    ? {
                        analysis_id: input.existingPendingRun.analysis_id,
                        interview_id: "interview-1",
                        analysis_model: "gpt-4o-mini",
                      }
                    : null,
                  error: null,
                };
              },
            };
          },
          insert(values: Record<string, unknown>) {
            inserts.push(values);
            return {
              select() {
                return {
                  async single() {
                    return {
                      data: { analysis_id: "analysis-1" },
                      error: input.insertError ?? null,
                    };
                  },
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };

  return { client, inserts, queriedTables, updates };
}

describe("interview transcript stabilization analysis enqueue", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates one pending analysis run after a transcript is marked stable", async () => {
    const fake = createSupabaseForStableTranscript({});
    const repository = new InterviewSessionRepository(
      fake.client as never,
      "participant-secret",
      "gpt-realtime",
      { analysisModel: "gpt-4o-mini" },
    );

    await repository.markTranscriptStable("interview-1", 5000);

    expect(fake.updates[0]).toMatchObject({
      transcript_status: "stable",
      transcript_reconciliation_timeout_ms: 5000,
    });
    expect(fake.inserts).toEqual([
      expect.objectContaining({
        interview_id: "interview-1",
        status: "pending",
        analysis_model: "gpt-4o-mini",
      }),
    ]);
  });

  it("does not create a duplicate run when one is already pending", async () => {
    const fake = createSupabaseForStableTranscript({
      existingPendingRun: { analysis_id: "analysis-existing" },
    });
    const repository = new InterviewSessionRepository(
      fake.client as never,
      "participant-secret",
      "gpt-realtime",
      { analysisModel: "gpt-4o-mini" },
    );

    await repository.markTranscriptStable("interview-1", 5000);

    expect(fake.inserts).toHaveLength(0);
  });

  it("does not queue analysis when canonical validation fails", async () => {
    const fake = createSupabaseForStableTranscript({
      segments: [
        {
          ...stableSegment,
          is_final: false,
        },
      ],
    });
    const repository = new InterviewSessionRepository(
      fake.client as never,
      "participant-secret",
      "gpt-realtime",
      { analysisModel: "gpt-4o-mini" },
    );

    await repository.markTranscriptStable("interview-1", 5000);

    expect(fake.updates[0]).toMatchObject({
      transcript_status: "failed",
    });
    expect(fake.queriedTables).not.toContain("analysis_runs");
  });

  it("leaves the transcript stable when automatic enqueue fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fake = createSupabaseForStableTranscript({
      insertError: { message: "database unavailable" },
    });
    const repository = new InterviewSessionRepository(
      fake.client as never,
      "participant-secret",
      "gpt-realtime",
      { analysisModel: "gpt-4o-mini" },
    );

    await repository.markTranscriptStable("interview-1", 5000);

    expect(fake.updates[0]).toMatchObject({
      transcript_status: "stable",
    });
    expect(errorSpy).toHaveBeenCalledWith(
      "Failed to auto-queue analysis run",
      expect.objectContaining({
        interviewId: "interview-1",
        error: "Failed to create pending analysis run: database unavailable",
      }),
    );
  });
});
