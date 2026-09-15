import { describe, expect, it, vi } from "vitest";
import { finalizeStaleLiveInterviewsWithDependencies } from "@/lib/worker/stale-session-finalizer";

describe("stale live interview finalizer", () => {
  it("finalizes interviews after the hard cap plus reconciliation timeout", async () => {
    const repository = {
      loadStaleLiveInterviews: vi.fn(async () => [
        {
          interviewId: "interview-1",
          realtimeCallId: "rtc_1",
          startedAt: "2026-09-14T00:00:00.000Z",
        },
        {
          interviewId: "interview-2",
          realtimeCallId: null,
          startedAt: "2026-09-14T00:01:00.000Z",
        },
      ]),
      markStaleLiveInterviewFinalized: vi.fn(async () => {}),
      markTranscriptStable: vi.fn(async () => {}),
    };
    const hangUpRealtimeCall = vi.fn(async () => {});

    const result = await finalizeStaleLiveInterviewsWithDependencies({
      repository,
      hangUpRealtimeCall,
      hardCapSeconds: 1200,
      reconciliationTimeoutMs: 5000,
      now: new Date("2026-09-14T00:30:05.000Z"),
    });

    expect(repository.loadStaleLiveInterviews).toHaveBeenCalledWith({
      cutoffIso: "2026-09-14T00:10:00.000Z",
      limit: 20,
    });
    expect(hangUpRealtimeCall).toHaveBeenCalledWith("rtc_1");
    expect(hangUpRealtimeCall).toHaveBeenCalledTimes(1);
    expect(repository.markStaleLiveInterviewFinalized).toHaveBeenCalledWith(
      "interview-1",
      "Live interview exceeded the hard cap without a clean sideband finalization signal.",
    );
    expect(repository.markTranscriptStable).toHaveBeenCalledWith(
      "interview-1",
      5000,
    );
    expect(repository.markTranscriptStable).toHaveBeenCalledWith(
      "interview-2",
      5000,
    );
    expect(result).toEqual({
      scanned: 2,
      finalized: 2,
      failed: 0,
      results: [
        { status: "finalized", interviewId: "interview-1" },
        { status: "finalized", interviewId: "interview-2" },
      ],
    });
  });

  it("keeps processing stale interviews after one finalization fails", async () => {
    const repository = {
      loadStaleLiveInterviews: vi.fn(async () => [
        {
          interviewId: "interview-1",
          realtimeCallId: "rtc_1",
          startedAt: "2026-09-14T00:00:00.000Z",
        },
        {
          interviewId: "interview-2",
          realtimeCallId: "rtc_2",
          startedAt: "2026-09-14T00:01:00.000Z",
        },
      ]),
      markStaleLiveInterviewFinalized: vi.fn(async (interviewId: string) => {
        if (interviewId === "interview-1") {
          throw new Error("database unavailable");
        }
      }),
      markTranscriptStable: vi.fn(async () => {}),
    };
    const hangUpRealtimeCall = vi.fn(async () => {});

    const result = await finalizeStaleLiveInterviewsWithDependencies({
      repository,
      hangUpRealtimeCall,
      hardCapSeconds: 1200,
      reconciliationTimeoutMs: 5000,
      now: new Date("2026-09-14T00:30:05.000Z"),
      limit: 5,
    });

    expect(repository.loadStaleLiveInterviews).toHaveBeenCalledWith({
      cutoffIso: "2026-09-14T00:10:00.000Z",
      limit: 5,
    });
    expect(hangUpRealtimeCall).toHaveBeenCalledWith("rtc_1");
    expect(hangUpRealtimeCall).toHaveBeenCalledWith("rtc_2");
    expect(repository.markTranscriptStable).toHaveBeenCalledTimes(1);
    expect(repository.markTranscriptStable).toHaveBeenCalledWith(
      "interview-2",
      5000,
    );
    expect(result).toEqual({
      scanned: 2,
      finalized: 1,
      failed: 1,
      results: [
        {
          status: "failed",
          interviewId: "interview-1",
          errorMessage: "database unavailable",
        },
        { status: "finalized", interviewId: "interview-2" },
      ],
    });
  });
});
