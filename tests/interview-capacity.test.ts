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
});
