import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260730153000_wave_1_database_lifecycle.sql",
  ),
  "utf8",
);

const normalized = migration.toLowerCase().replace(/\s+/g, " ");

const requiredTables = [
  "participants",
  "interviews",
  "transcript_segments",
  "analysis_runs",
  "objective_results",
  "objective_result_segments",
  "interview_quotes",
  "interview_quote_segments",
  "analysis_eligibility_segments",
  "theme_assignments",
  "theme_assignment_segments",
];

const objectiveValues = [
  "current_issue",
  "enduring_concern",
  "theory_vs_practice",
  "recent_change",
  "unmet_need",
  "innovation_orientation",
];

describe("Wave 1 database migration", () => {
  it("creates the required MVP tables", () => {
    for (const table of requiredTables) {
      expect(normalized).toContain(`create table public.${table}`);
    }
  });

  it("locks the objective enum to exactly the six interview objectives", () => {
    const objectiveEnum = migration.match(
      /create type public\.objective as enum \(([\s\S]*?)\);/,
    );

    expect(objectiveEnum?.[1].match(/'[^']+'/g)?.map((value) => value.slice(1, -1))).toEqual(
      objectiveValues,
    );
  });

  it("represents transcript stable and failed states in schema", () => {
    expect(normalized).toContain("create type public.transcript_status as enum");
    expect(normalized).toContain("'pending'");
    expect(normalized).toContain("'stabilizing'");
    expect(normalized).toContain("'stable'");
    expect(normalized).toContain("'failed'");
    expect(normalized).toContain("transcript_stabilized_at timestamptz");
    expect(normalized).toContain("transcript_reconciliation_timeout_ms integer");
    expect(normalized).toContain("transcript_processing_error text");
  });

  it("stores usage and cost fields on interview and analysis records", () => {
    expect(normalized).toContain("estimated_input_tokens integer");
    expect(normalized).toContain("estimated_output_tokens integer");
    expect(normalized).toContain("estimated_live_cost_usd numeric");
    expect(normalized).toContain("estimated_total_cost_usd numeric");
    expect(normalized).toContain("estimated_analysis_cost_usd numeric");
    expect(normalized).toContain("create type public.cost_category as enum");
  });

  it("uses a partial unique index for provider event idempotency", () => {
    expect(normalized).toContain(
      "create unique index transcript_segments_provider_event_unique",
    );
    expect(normalized).toContain(
      "on public.transcript_segments (interview_id, provider_event_id)",
    );
    expect(normalized).toContain("where provider_event_id is not null");
  });

  it("enforces exactly six objective rows before an analysis succeeds", () => {
    expect(normalized).toContain(
      "validate_succeeded_analysis_objective_count",
    );
    expect(normalized).toContain("objective_count <> 6");
    expect(normalized).toContain(
      "create trigger analysis_runs_require_six_objective_results",
    );
  });

  it("uses normalized evidence tables with final-segment validation triggers", () => {
    for (const table of [
      "objective_result_segments",
      "interview_quote_segments",
      "analysis_eligibility_segments",
      "theme_assignment_segments",
    ]) {
      expect(normalized).toContain(`create table public.${table}`);
      expect(normalized).toContain("references public.transcript_segments(segment_id)");
    }

    expect(normalized).toContain("segment_is_final is not true");
    expect(normalized).toContain("must reference final transcript segments");
  });

  it("blocks analysis runs until transcript stable state is recorded", () => {
    expect(normalized).toContain("validate_analysis_transcript_stable");
    expect(normalized).toContain("parent_transcript_status <> 'stable'");
    expect(normalized).toContain(
      "create trigger analysis_runs_require_stable_transcript",
    );
  });

  it("keeps direct identifiers out of analytical tables", () => {
    const analyticalTables = [
      "analysis_runs",
      "objective_results",
      "interview_quotes",
      "theme_assignments",
    ];

    for (const table of analyticalTables) {
      const tableSql = migration.match(
        new RegExp(`create table public\\.${table} \\([\\s\\S]*?\\);`),
      )?.[0];

      expect(tableSql).toBeDefined();
      expect(tableSql).not.toMatch(/\bemail\b/);
      expect(tableSql).not.toMatch(/\bname\b/);
      expect(tableSql).not.toMatch(/\bgfoa_member_id\b/);
      expect(tableSql).not.toMatch(/\borganization_name\b/);
    }
  });

  it("enables RLS with a tighter participant identity boundary", () => {
    for (const table of requiredTables) {
      expect(normalized).toContain(
        `alter table public.${table} enable row level security`,
      );
    }

    expect(normalized).toContain("participants_admin_read");
    expect(normalized).toContain("using (public.is_admin())");
    expect(normalized).toContain("analysis_runs_staff_read");
    expect(normalized).toContain("using (public.is_staff_or_admin())");
  });

  it("prevents active interviews without both browser and sideband connections", () => {
    expect(normalized).toContain("validate_interview_active_connections");
    expect(normalized).toContain("new.lifecycle_status = 'active'");
    expect(normalized).toContain("new.browser_connection_status <> 'connected'");
    expect(normalized).toContain("new.sideband_connection_status <> 'connected'");
  });
});
