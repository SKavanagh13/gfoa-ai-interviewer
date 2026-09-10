import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  AdminRepository,
  normalizeAdminInterviewListQuery,
  selectAnalysisRun,
} from "@/lib/admin/repository";
import type { AdminAnalysisRunSummary } from "@/lib/admin/types";

function run(
  analysisId: string,
  status: AdminAnalysisRunSummary["status"],
  createdAt: string,
): AdminAnalysisRunSummary {
  return {
    analysisId,
    status,
    analysisModel: null,
    analysisPromptVersion: null,
    outputSpecificationVersion: null,
    structuredSchemaVersion: null,
    estimatedInputTokens: null,
    estimatedOutputTokens: null,
    estimatedAnalysisCostUsd: null,
    errorMessage: null,
    createdAt,
  };
}

describe("Wave 6 admin repository mapping", () => {
  it("selects the most recent succeeded analysis by default", () => {
    const runs = [
      run("failed-newest", "failed", "2026-08-01T12:00:00.000Z"),
      run("succeeded-newer", "succeeded", "2026-08-01T11:00:00.000Z"),
      run("succeeded-older", "succeeded", "2026-08-01T10:00:00.000Z"),
    ];

    expect(selectAnalysisRun(runs)?.analysisId).toBe("succeeded-newer");
  });

  it("falls back to the most recent run of any status", () => {
    const runs = [
      run("pending-newest", "pending", "2026-08-01T12:00:00.000Z"),
      run("failed-older", "failed", "2026-08-01T10:00:00.000Z"),
    ];

    expect(selectAnalysisRun(runs)?.analysisId).toBe("pending-newest");
  });

  it("honors an explicit selected analysis ID when present", () => {
    const runs = [
      run("newer", "succeeded", "2026-08-01T12:00:00.000Z"),
      run("requested", "failed", "2026-08-01T10:00:00.000Z"),
    ];

    expect(selectAnalysisRun(runs, "requested")?.analysisId).toBe("requested");
  });

  it("normalizes admin list paging and filters", () => {
    expect(
      normalizeAdminInterviewListQuery({
        filters: {
          lifecycleStatus: "ended",
          latestAnalysisStatus: "succeeded",
          transcriptStatus: "invalid" as never,
        },
        page: -2,
        pageSize: 1_000,
      }),
    ).toMatchObject({
      filters: {
        lifecycleStatus: "ended",
        latestAnalysisStatus: "succeeded",
        transcriptStatus: null,
      },
      page: 1,
      pageSize: 100,
    });
  });

  it("filters admin interview lists before paginating", async () => {
    const repository = new AdminRepository(
      createAdminListSupabase({
        interviews: [
          interviewRow({
            interview_id: "interview-1",
            created_at: "2026-08-01T12:00:00.000Z",
            transcript_status: "stable",
          }),
          interviewRow({
            interview_id: "interview-2",
            created_at: "2026-08-01T11:00:00.000Z",
            transcript_status: "stable",
          }),
          interviewRow({
            interview_id: "interview-3",
            created_at: "2026-08-01T10:00:00.000Z",
            transcript_status: "pending",
          }),
        ],
        analysisRuns: [
          analysisRunRow({
            interview_id: "interview-1",
            status: "failed",
            created_at: "2026-08-01T12:30:00.000Z",
          }),
          analysisRunRow({
            interview_id: "interview-1",
            status: "succeeded",
            created_at: "2026-08-01T12:15:00.000Z",
          }),
          analysisRunRow({
            interview_id: "interview-3",
            status: "succeeded",
            created_at: "2026-08-01T10:30:00.000Z",
          }),
        ],
      }) as never,
    );

    const result = await repository.loadInterviewList({
      filters: {
        latestAnalysisStatus: "missing",
        transcriptStatus: "stable",
      },
      page: 1,
      pageSize: 1,
    });

    expect(result).toMatchObject({
      page: 1,
      pageSize: 1,
      totalCount: 1,
      totalPages: 1,
    });
    expect(result.items.map((item) => item.interviewId)).toEqual([
      "interview-2",
    ]);
  });
});

type InterviewListRow = {
  analysis_eligibility: string | null;
  consented_at: string | null;
  created_at: string;
  end_disposition: string | null;
  ended_at: string | null;
  interview_id: string;
  lifecycle_status: string;
  negative_reaction_flag: boolean | null;
  started_at: string | null;
  transcript_status: string;
};

type AnalysisRunListRow = {
  created_at: string;
  interview_id: string;
  status: AdminAnalysisRunSummary["status"];
};

function interviewRow(
  overrides: Partial<InterviewListRow> & Pick<InterviewListRow, "interview_id">,
): InterviewListRow {
  return {
    analysis_eligibility: null,
    consented_at: null,
    created_at: "2026-08-01T00:00:00.000Z",
    end_disposition: null,
    ended_at: null,
    lifecycle_status: "created",
    negative_reaction_flag: null,
    started_at: null,
    transcript_status: "pending",
    ...overrides,
  };
}

function analysisRunRow(overrides: AnalysisRunListRow): AnalysisRunListRow {
  return overrides;
}

function createAdminListSupabase(input: {
  analysisRuns: AnalysisRunListRow[];
  interviews: InterviewListRow[];
}) {
  return {
    from(table: string) {
      if (table === "interviews") {
        return new FakeQuery(input.interviews);
      }

      if (table === "analysis_runs") {
        return new FakeQuery(input.analysisRuns);
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };
}

class FakeQuery<T extends Record<string, unknown>> {
  private filters: Array<(row: T) => boolean> = [];
  private orderKey: keyof T | null = null;
  private orderAscending = true;

  constructor(private readonly rows: T[]) {}

  select() {
    return this;
  }

  eq(key: keyof T, value: unknown) {
    this.filters.push((row) => row[key] === value);
    return this;
  }

  is(key: keyof T, value: unknown) {
    this.filters.push((row) => row[key] === value);
    return this;
  }

  in(key: keyof T, values: unknown[]) {
    this.filters.push((row) => values.includes(row[key]));
    return this;
  }

  order(key: keyof T, options: { ascending: boolean }) {
    this.orderKey = key;
    this.orderAscending = options.ascending;
    return this;
  }

  then<TResult1 = { data: T[]; error: null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: T[]; error: null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    void onrejected;
    const data = this.apply();
    return Promise.resolve(
      onfulfilled ? onfulfilled({ data, error: null }) : ({ data, error: null } as TResult1),
    );
  }

  private apply(): T[] {
    const filtered = this.rows.filter((row) =>
      this.filters.every((filter) => filter(row)),
    );

    if (!this.orderKey) {
      return filtered;
    }

    return [...filtered].sort((left, right) => {
      const leftValue = String(left[this.orderKey as keyof T]);
      const rightValue = String(right[this.orderKey as keyof T]);
      const comparison = leftValue.localeCompare(rightValue);
      return this.orderAscending ? comparison : -comparison;
    });
  }
}
