# Waves 0 and 1 Implementation Plan

## Source Requirements Read

This plan is based on the following binding project documents:

- `AGENTS.md`
- `docs/locked/01-ai-interviewer-operating-principles.md`
- `docs/locked/02-ai-interviewer-guide.md`
- `docs/locked/03-per-interview-output-specification.md`
- `docs/locked/04-ai-voice-interviewer-mvp-flow.md`
- `docs/locked/05-ai-voice-interviewer-mvp-technical-specification.md`

The plan covers only Wave 0 and Wave 1 from the MVP Technical Specification. It intentionally excludes future-wave behavior such as participant intake, consent UI, Realtime sessions, transcript capture, post-interview analysis, quote verification, admin review UI, dashboards, formal taxonomies, synthetic personas, and cross-interview analytics.

## Material Conflicts and Ambiguities

### 1. Locked Directory Casing

`AGENTS.md` says locked requirements live in `docs/locked/`, but the repository currently contains `docs/Locked/`.

On Windows this path resolves, but Linux CI or deployment environments may treat the paths as different. Wave 0 should normalize the directory name to `docs/locked/` unless the project intentionally wants the capitalized form preserved.

### 2. README Authority

`README.md` says the locked requirements are in "this folder," but it currently sits at the repository root, not inside `docs/Locked/` or `docs/locked/`.

It also defines precedence among locked documents. Because it is not itself located in the locked requirements folder, this plan treats it as useful project guidance, not as a locked requirement, unless explicitly designated otherwise.

### 3. Repository Bootstrap State

The repository currently appears to be at documentation/bootstrap state. `git ls-files` shows only `README.md` tracked, while `AGENTS.md` and `docs/` are untracked. There is no existing application skeleton to integrate into.

Wave 0 should therefore be treated as a true project initialization wave.

### 4. Supabase Scope in Wave 1

Wave 1 requires migrations, RLS foundations, and generated TypeScript database types. The technical specification recommends Supabase, so the plan assumes Supabase Postgres migrations and type generation.

However, remote Supabase project linking, production credentials, and deployed database setup should remain out of scope unless separately requested. Local migration validation and generated types are sufficient for Wave 1.

### 5. Segment Evidence Storage Decision

The technical specification allows either UUID arrays or normalized relations for evidence references. This plan resolves that ambiguity for implementation: Wave 1 should use normalized join tables for evidence references rather than UUID arrays.

Use join tables for:

- objective-result supporting segments;
- interview quote source segments;
- analysis eligibility supporting segments, if more than one source segment is needed.

This preserves database-enforced referential integrity to canonical `transcript_segments` and supports triggers that reject references to non-final segments.

### 6. Cross-Cutting Theme Storage Decision

The Per-Interview Output Specification requires Cross-Cutting Themes: Key Tension, Recurring Concern, Opportunity Signal, and Emerging Signal. Wave 1 should reserve structured storage for these fields rather than relying only on raw JSON.

Preferred implementation: include nullable structured columns on `analysis_runs` for the four cross-cutting theme fields, plus optional evidence join rows if the implementation needs traceability at this layer. Do not create a formal taxonomy.

## Current Wave Scope

This plan covers:

- Wave 0: Repository Skeleton
- Wave 1: Database and Lifecycle

No future-wave functionality should be built during these waves.

## Wave 0: Repository Skeleton

### Goal

Establish a strict, testable Next.js TypeScript foundation that preserves the locked documents and creates placeholders for future prompt and schema work without implementing future-wave behavior.

### Scope

Wave 0 includes:

- app initialization;
- strict TypeScript;
- lint, tests, and production build setup;
- environment validation foundation;
- base folder structure;
- locked documents retained as versioned source files;
- prompt placeholders committed.

Wave 0 excludes:

- participant intake;
- consent flow;
- membership lookup;
- OpenAI Realtime integration;
- sideband WebSocket capture;
- transcript persistence;
- analysis pipeline;
- quote verification;
- admin authentication or review UI.

### Implementation Steps

1. Normalize locked requirement paths.

   - Ensure the locked documents live at `docs/locked/`.
   - Do not edit locked document contents.
   - Keep `AGENTS.md` at the repository root.
   - If needed, update project README wording so it accurately describes the locked document location without changing substantive requirements.

2. Initialize the application skeleton.

   - Use Next.js App Router.
   - Use TypeScript with strict mode enabled.
   - Configure the project for server/client separation.
   - Avoid adding implementation code for future waves.

3. Create the recommended base structure.

   ```text
   /app
     /interview
     /admin
     /api
   /lib
     /supabase
     /openai
     /interview
     /analysis
     /validation
   /prompts
     operating-principles.md
     interview-guide.md
     output-specification.md
     live-interviewer.system.md
     post-interview-analysis.system.md
   /schemas
     post-interview-output.schema.json
   /supabase
     /migrations
   /types
   /tests
   ```

4. Add minimal placeholder pages.

   - Add a minimal root page.
   - Add a placeholder `/interview` route.
   - Add a placeholder `/admin` route.
   - These pages should clearly be nonfunctional placeholders and should not implement intake, consent, auth, Realtime behavior, or analysis review.

5. Add prompt placeholders.

   - Create prompt placeholder files in `prompts/`.
   - The placeholders may reference the locked documents and state their intended future use.
   - Do not duplicate or rewrite locked document content unless the project intentionally chooses prompt snapshots.
   - Do not produce live-interviewer or post-analysis prompt behavior yet.

6. Add environment validation foundation.

   - Add a server-side environment validation module, likely `lib/env.ts`.
   - Validate only variables needed for Waves 0 and 1.
   - Declare future variables carefully without using them in behavior.
   - Ensure service-role credentials are treated as server-only.
   - Avoid exposing permanent OpenAI or Supabase service-role keys to browser code.

7. Add lint, typecheck, test, and build scripts.

   Recommended scripts:

   - `npm run lint`
   - `npm run typecheck`
   - `npm test`
   - `npm run build`

   Use Vitest or equivalent for unit tests.

8. Add initial tests.

   - Test environment validation behavior.
   - Test that locked documents exist at expected normalized paths.
   - Add a basic project smoke test if useful.
   - Do not test future-wave behavior that has not been implemented.

### Wave 0 Acceptance Criteria

Wave 0 is complete when:

- the application skeleton exists;
- TypeScript strict mode is enabled;
- lint, tests, typecheck, and production build are configured;
- environment validation exists;
- locked documents are retained and inspectable;
- prompt placeholders exist;
- no future-wave features are implemented;
- all required verification commands pass.

### Wave 0 Verification Commands

Run:

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

## Wave 1: Database and Lifecycle

### Goal

Define Supabase/Postgres schema foundations, lifecycle enums, constraints, RLS baseline, generated database types, and lifecycle tests.

Wave 1 should establish the data model and lifecycle invariants needed by later waves without implementing intake, Realtime interview capture, transcript analysis, quote verification, or admin review behavior.

### Scope

Wave 1 includes:

- SQL migrations;
- lifecycle enums and constraints;
- RLS foundations;
- generated TypeScript database types;
- lifecycle and invariant tests.

Wave 1 excludes:

- participant-facing intake and consent UI;
- membership lookup behavior;
- actual interview creation flow;
- browser WebRTC;
- OpenAI Realtime session creation;
- sideband WebSocket connection;
- transcript event persistence from provider events;
- transcript stabilization implementation;
- post-interview model analysis;
- deterministic quote matching implementation;
- authenticated admin review UI.

### Implementation Steps

1. Create initial migration structure.

   - Add a first migration under `supabase/migrations/`.
   - Use version-controlled SQL.
   - Include the required MVP tables:
     - `participants`
     - `interviews`
     - `transcript_segments`
     - `analysis_runs`
     - `objective_results`
     - `interview_quotes`
     - `theme_assignments`, if included as the lightweight plain-language table described in the MVP Flow.

2. Define lifecycle and analysis enums.

   Suggested enums:

   - `end_disposition`: `completed`, `participant_ended`, `technical_failure`
   - `analysis_eligibility`: `eligible`, `ineligible_insufficient_content`
   - `analysis_run_status`: `pending`, `succeeded`, `failed`
   - `transcript_status`: `pending`, `stabilizing`, `stable`, `failed`
   - `objective`: exactly `current_issue`, `enduring_concern`, `theory_vs_practice`, `recent_change`, `unmet_need`, `innovation_orientation`
   - `objective_coverage`: `sufficiently_covered`, `partially_covered`, `not_covered`, `unclear`
   - `confidence`: `high`, `moderate`, `low`
   - `overall_quality`: `strong`, `adequate`, `limited`, `unusable`
   - `quote_verification_status`: values that distinguish accepted, rejected, and reviewable quote proposals

3. Create the `participants` table.

   Purpose: stores direct identity and confirmed profile linkage.

   Suggested fields:

   - `participant_id` UUID primary key
   - `gfoa_member_id` nullable
   - `email`
   - `name`
   - `title`
   - `organization_name`
   - `government_type`
   - `state_or_region`
   - `organization_size_band`
   - `experience_band`
   - `profile_status`
   - `profile_confirmed_at`
   - timestamps

   Requirement: this table is tightly permissioned and is the proper location for direct identifiers.

4. Create the `interviews` table.

   Purpose: one row per interview session and lifecycle record.

   Suggested fields:

   - `interview_id` UUID primary key
   - `participant_id` foreign key
   - `end_disposition`
   - `analysis_eligibility`
   - `analysis_eligibility_supporting_objective`
   - eligibility supporting segment references through a normalized join table, if more than one source segment is needed
   - `transcript_status`
   - `transcript_stabilized_at`
   - `transcript_reconciliation_timeout_ms`
   - `transcript_processing_error`
   - `negative_reaction_flag` nullable
   - `consent_version`
   - `consented_at`
   - `started_at`
   - `ended_at`
   - `duration_seconds`
   - `operating_principles_version`
   - `interview_guide_version`
   - `live_prompt_version`
   - `audio_storage_path`
   - `transcript_storage_path`
   - `realtime_call_id`
   - `sideband_connection_status`
   - `estimated_input_tokens`
   - `estimated_output_tokens`
   - `estimated_live_cost_usd`
   - `estimated_total_cost_usd`
   - `cost_category`, or equivalent field distinguishing completed, abandoned, and technical-failure session costs
   - `technical_error`
   - timestamps

   Requirement: sideband-related fields are schema foundations only in Wave 1. No Realtime behavior should be implemented.

   Requirement: transcript stability must be represented in schema before analysis can begin. `transcript_status = stable` and `transcript_stabilized_at` are the durable markers later waves should check before creating analysis runs. The reconciliation timeout must be stored on the interview or validated as an environment-configured constant and recorded when stabilization runs.

5. Create the `transcript_segments` table.

   Purpose: canonical ordered transcript segments.

   Suggested fields:

   - `segment_id` UUID primary key
   - `interview_id` foreign key
   - `sequence_number`
   - `speaker`
   - `text`
   - `start_time_ms`
   - `end_time_ms`
   - `provider_event_id`
   - `is_final`
   - timestamps

   Required constraints:

   - unique `(interview_id, sequence_number)`;
   - partial unique index on `(interview_id, provider_event_id) WHERE provider_event_id IS NOT NULL`;
   - evidence references must not point to non-final segments.

6. Create the `analysis_runs` table.

   Purpose: one record per analysis attempt. Prior runs must never be overwritten.

   Suggested fields:

   - `analysis_id` UUID primary key
   - `interview_id` foreign key
   - `status`
   - `analysis_model`
   - `analysis_prompt_version`
   - `output_specification_version`
   - `structured_schema_version`
   - `overall_summary`
   - `primary_takeaway`
   - `additional_issue`
   - `overall_quality`
   - `key_tension`
   - `recurring_concern`
   - `opportunity_signal`
   - `emerging_signal`
   - `limitations`
   - `raw_structured_output`
   - `estimated_input_tokens`
   - `estimated_output_tokens`
   - `estimated_analysis_cost_usd`
   - `error_message`
   - timestamps

7. Create the `objective_results` table.

   Purpose: exactly six objective records for every succeeded analysis.

   Suggested fields:

   - `objective_result_id` UUID primary key
   - `analysis_id` foreign key
   - `objective`
   - `narrative_summary`
   - `coverage`
   - `confidence`
   - `structured_fields` JSONB
   - timestamps

   Required constraints:

   - unique `(analysis_id, objective)`;
   - a succeeded analysis must persist exactly six objective-result rows;
   - objective absence must never represent non-coverage.

   Evidence references should be stored in a normalized join table, for example `objective_result_segments`, with foreign keys to `objective_results` and `transcript_segments`.

8. Create the `interview_quotes` table.

   Purpose: accepted, rejected, or reviewable representative quote proposals.

   Suggested fields:

   - `quote_id` UUID primary key
   - `analysis_id` foreign key
   - `interview_id` foreign key
   - `quote_text`
   - `start_time_ms`
   - `objective`
   - `verification_status`
   - `reason_selected`
   - timestamps

   Requirement: deterministic verification itself belongs to a later wave, but the schema must support verification status.

   Quote source references should be stored in a normalized join table, for example `interview_quote_segments`, with foreign keys to `interview_quotes` and `transcript_segments`.

9. Optionally create lightweight `theme_assignments`.

   Purpose: plain-language labels and evidence references only.

   Constraints:

   - no formal taxonomy;
   - no cross-interview analytics;
   - no prevalence or trend claims.

10. Implement schema invariants.

   Required invariants:

   - a succeeded analysis has exactly six objective-result rows;
   - `(analysis_id, objective)` is unique;
   - absence of objective-result rows never means `not covered`;
   - analysis eligibility records supporting objective and canonical segment IDs when eligible;
   - transcript segments are written incrementally and idempotently;
   - analysis cannot begin until transcript stable state is recorded;
   - Realtime call ID and sideband connection status are retained;
   - a session cannot be marked normally active unless both browser and server-side connections have been established.

   Required enforcement mechanisms:

   - add a partial unique index on `(interview_id, provider_event_id) WHERE provider_event_id IS NOT NULL`;
   - add a database trigger on `analysis_runs` status changes to `succeeded` that raises an exception unless exactly six `objective_results` rows exist for the analysis;
   - add database triggers or trigger-backed validation functions on evidence join tables so objective results, quote sources, and eligibility evidence can reference only final transcript segments;
   - add database-level or trigger-backed checks preventing analysis runs from starting before the parent interview has `transcript_status = stable`;
   - use normalized evidence join tables rather than UUID arrays so foreign keys preserve source-segment integrity.

   Wave 1 should create these fields, constraints, triggers, and tests even though later waves will be responsible for the runtime paths that exercise them.

11. Add RLS foundations.

   - Enable RLS on all tables.
   - Start from restrictive policies.
   - Keep participant identity more restricted than analytical output.
   - Ensure service-role/server-side writes are possible for lifecycle processing.
   - Define authenticated staff read foundations where appropriate.
   - Avoid exposing participant identity broadly.

12. Add generated TypeScript database types.

   - Add a script to generate Supabase database types into `types/database.types.ts`.
   - Prefer generating from local migrations.
   - If local Supabase is unavailable, document the limitation and do not pretend generated types are current.

13. Add lifecycle and invariant tests.

   Test at minimum:

   - enum values match locked lifecycle requirements;
   - objective enum contains exactly `current_issue`, `enduring_concern`, `theory_vs_practice`, `recent_change`, `unmet_need`, and `innovation_orientation`;
   - transcript status transitions can represent `pending`, `stabilizing`, `stable`, and `failed`;
   - analysis creation or status progression is blocked until transcript stable state is recorded;
   - duplicate transcript sequence numbers fail;
   - duplicate non-null `(interview_id, provider_event_id)` values are rejected by the partial unique index;
   - multiple null provider event IDs are allowed;
   - analysis or quote evidence cannot cite non-final transcript segments;
   - direct identifiers are not duplicated into analytical tables such as `objective_results`;
   - the database trigger rejects any attempt to mark an analysis as `succeeded` with fewer or more than six objective-result rows;
   - prior analysis runs remain available after reprocessing;
   - cost and usage fields are present on `interviews` and `analysis_runs`;
   - RLS policies enforce the intended identity/access boundary where practical.

### Wave 1 Acceptance Criteria

Wave 1 is complete when:

- migrations define required MVP tables;
- lifecycle enums and constraints exist;
- transcript stable state and stabilization failure are represented in schema;
- usage and cost fields are represented in schema;
- exact objective enum values are fixed and tested;
- provider-event idempotency uses a partial unique index;
- six objective-result rows are enforced by a database trigger before an analysis can be marked succeeded;
- evidence references use normalized join tables and reject non-final transcript segments;
- RLS is enabled with restrictive foundations;
- TypeScript database types are generated or the generation blocker is explicitly documented;
- lifecycle tests pass;
- schema supports later waves without implementing them;
- no direct identifiers are duplicated into analytical records;
- no future-wave behavior is built.

### Wave 1 Verification Commands

Run, as applicable:

```bash
supabase db reset
supabase gen types typescript --local > types/database.types.ts
npm test
npm run lint
npm run typecheck
npm run build
```

If Supabase local services are not available, record that as an unresolved setup risk and still run all available project-level checks.

## Review Checklist for Claude Code

Claude Code should review this plan for:

- conflicts with `AGENTS.md` or locked requirements;
- accidental inclusion of future-wave features;
- insufficient handling of identity separation;
- weak database invariants around six objective results;
- missing lifecycle states;
- missing RLS/security foundations;
- ambiguity around generated database types;
- any schema choice likely to cause substantial rework in Waves 2 through 6.

## Non-Goals for Waves 0 and 1

Do not implement:

- cross-interview dashboards;
- aggregate analytics;
- formal theme taxonomy;
- synthetic personas;
- participant intake UI beyond placeholders;
- consent flow beyond schema support;
- GFOA member-directory lookup;
- OpenAI Realtime session creation;
- WebRTC client connection;
- sideband WebSocket connection;
- transcript event capture;
- transcript stabilization runtime;
- post-interview analysis model calls;
- deterministic quote verification runtime;
- admin review interface beyond placeholders.

## Completion Reporting Standard

After each implementation wave, report:

- current wave and exact scope completed;
- changed files;
- commands run;
- command results;
- acceptance criteria status;
- unresolved risks or requirement ambiguities.
