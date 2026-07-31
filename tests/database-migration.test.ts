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

const wave2Migration = readFileSync(
  path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260731011500_wave_2_atomic_intake_creation.sql",
  ),
  "utf8",
);

const wave3Migration = readFileSync(
  path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260731120000_wave_3_live_session_control.sql",
  ),
  "utf8",
);

const normalized = migration.toLowerCase().replace(/\s+/g, " ");
const normalizedWave2 = wave2Migration.toLowerCase().replace(/\s+/g, " ");
const normalizedWave3 = wave3Migration.toLowerCase().replace(/\s+/g, " ");

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

  it("prevents objective result deletion after an analysis succeeds", () => {
    expect(normalized).toContain(
      "prevent_objective_result_deletion_if_succeeded",
    );
    expect(normalized).toContain("run_status = 'succeeded'");
    expect(normalized).toContain(
      "cannot delete objective results from a succeeded analysis run",
    );
    expect(normalized).toContain(
      "create trigger objective_results_prevent_deletion_if_succeeded",
    );
    expect(normalized).toContain("before delete on public.objective_results");
  });

  it("requires canonical segment evidence before an interview is marked eligible", () => {
    expect(normalized).toContain("validate_eligible_interview_has_segments");
    expect(normalized).toContain("new.analysis_eligibility = 'eligible'");
    expect(normalized).toContain(
      "from public.analysis_eligibility_segments aes",
    );
    expect(normalized).toContain("seg_count = 0");
    expect(normalized).toContain("interviews_require_eligibility_segments");
  });

  it("restricts interview deletion when analysis history exists", () => {
    const analysisRunsTable = migration.match(
      /create table public\.analysis_runs \([\s\S]*?\);/,
    )?.[0];

    expect(analysisRunsTable).toBeDefined();
    expect(analysisRunsTable).toContain(
      "references public.interviews(interview_id) on delete restrict",
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

describe("Wave 2 database migration", () => {
  it("creates participant and interview records atomically through one RPC", () => {
    expect(normalizedWave2).toContain(
      "create or replace function public.create_participant_and_interview",
    );
    expect(normalizedWave2).toContain("returns table");
    expect(normalizedWave2).toContain("insert into public.participants");
    expect(normalizedWave2).toContain("returning participants.participant_id");
    expect(normalizedWave2).toContain("insert into public.interviews");
    expect(normalizedWave2).toContain("created_participant_id");
    expect(normalizedWave2).toContain("nullif(p_name, '')");
    expect(normalizedWave2).toContain("nullif(p_organization_name, '')");
    expect(normalizedWave2).not.toContain("commit");
  });

  it("limits direct RPC execution to the service role", () => {
    expect(normalizedWave2).toContain(
      "revoke all on function public.create_participant_and_interview",
    );
    expect(normalizedWave2).toContain("from public, anon, authenticated");
    expect(normalizedWave2).toContain("to service_role");
  });
});

describe("Wave 3 database migration", () => {
  it("stores only hashed participant session tokens", () => {
    expect(normalizedWave3).toContain(
      "create table public.participant_session_tokens",
    );
    expect(normalizedWave3).toContain("token_digest text not null");
    expect(normalizedWave3).toContain("expires_at timestamptz not null");
    expect(normalizedWave3).not.toContain("raw_token");
    expect(normalizedWave3).not.toContain("token text not null");
  });

  it("adds participant session creation to the atomic intake RPC", () => {
    expect(normalizedWave3).toContain("p_interview_id uuid");
    expect(normalizedWave3).toContain("p_participant_session_token_digest text");
    expect(normalizedWave3).toContain("p_participant_session_expires_at timestamptz");
    expect(normalizedWave3).toContain(
      "insert into public.participant_session_tokens",
    );
  });

  it("provides a mutual idempotent activation RPC", () => {
    expect(normalizedWave3).toContain(
      "create or replace function public.try_mark_interview_active",
    );
    expect(normalizedWave3).toContain("browser_connection_status = 'connected'");
    expect(normalizedWave3).toContain("sideband_connection_status = 'connected'");
    expect(normalizedWave3).toContain("and lifecycle_status = 'created'");
  });
});
