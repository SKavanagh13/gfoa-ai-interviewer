import { describe, expect, it } from "vitest";
import { InterviewSessionRepository } from "@/lib/interview/session-repository";

describe("interview capacity guard", () => {
  it("counts active and ending live interviews for admission control", async () => {
    const selectCalls: unknown[] = [];
    const isCalls: unknown[] = [];
    const neqCalls: unknown[] = [];
    const orCalls: unknown[] = [];
    const client = {
      from(table: string) {
        expect(table).toBe("interviews");
        return {
          select(...args: unknown[]) {
            selectCalls.push(args);
            return {
              is(...args: unknown[]) {
                isCalls.push(args);
                return {
                  neq(...neqArgs: unknown[]) {
                    neqCalls.push(neqArgs);
                    return {
                      async or(...orArgs: unknown[]) {
                        orCalls.push(orArgs);
                        return { count: 7, error: null };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      },
    };
    const repository = new InterviewSessionRepository(
      client as never,
      "participant-secret",
      "gpt-realtime",
    );

    await expect(repository.countActiveLiveInterviews()).resolves.toBe(7);
    expect(selectCalls).toEqual([
      ["interview_id", { count: "exact", head: true }],
    ]);
    expect(isCalls).toEqual([["end_disposition", null]]);
    expect(neqCalls).toEqual([["lifecycle_status", "failed"]]);
    expect(orCalls).toEqual([
      ["lifecycle_status.in.(active,ending),realtime_call_id.not.is.null"],
    ]);
  });

  it("loads only stale active or ending interviews for worker finalization", async () => {
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const client = {
      from(table: string) {
        expect(table).toBe("interviews");
        return {
          select(...args: unknown[]) {
            calls.push({ method: "select", args });
            return this;
          },
          is(...args: unknown[]) {
            calls.push({ method: "is", args });
            return this;
          },
          neq(...args: unknown[]) {
            calls.push({ method: "neq", args });
            return this;
          },
          in(...args: unknown[]) {
            calls.push({ method: "in", args });
            return this;
          },
          not(...args: unknown[]) {
            calls.push({ method: "not", args });
            return this;
          },
          lte(...args: unknown[]) {
            calls.push({ method: "lte", args });
            return this;
          },
          order(...args: unknown[]) {
            calls.push({ method: "order", args });
            return this;
          },
          async limit(...args: unknown[]) {
            calls.push({ method: "limit", args });
            return {
              data: [
                {
                  interview_id: "interview-1",
                  realtime_call_id: "rtc_123",
                  started_at: "2026-09-14T00:00:00.000Z",
                },
              ],
              error: null,
            };
          },
        };
      },
    };
    const repository = new InterviewSessionRepository(
      client as never,
      "participant-secret",
      "gpt-realtime",
    );

    await expect(
      repository.loadStaleLiveInterviews({
        cutoffIso: "2026-09-14T00:10:00.000Z",
        limit: 10,
      }),
    ).resolves.toEqual([
      {
        interviewId: "interview-1",
        realtimeCallId: "rtc_123",
        startedAt: "2026-09-14T00:00:00.000Z",
      },
    ]);
    expect(calls).toEqual([
      {
        method: "select",
        args: ["interview_id, realtime_call_id, started_at"],
      },
      { method: "is", args: ["end_disposition", null] },
      { method: "neq", args: ["lifecycle_status", "failed"] },
      { method: "in", args: ["lifecycle_status", ["active", "ending"]] },
      { method: "not", args: ["started_at", "is", null] },
      { method: "lte", args: ["started_at", "2026-09-14T00:10:00.000Z"] },
      { method: "order", args: ["started_at", { ascending: true }] },
      { method: "limit", args: [10] },
    ]);
  });
});
