# Wave 6 Implementation Plan - Admin Review

## Status

Wave 6 scope is Admin Review only. This plan does not implement code.

The plan was prepared after reviewing:

- `AGENTS.md`
- every file in `docs/locked/`
- the current `main` branch after the merged Wave 5 post-interview analysis work
- the existing admin placeholder route, Supabase schema/RLS migrations, analysis runner, analysis repository, and test structure

Locked requirements remain binding. If any implementation detail conflicts with `docs/locked/`, stop and resolve the conflict before editing code.

## Current Repository Baseline

- `app/admin/page.tsx` is a placeholder only.
- Wave 5 added server-only post-interview analysis generation and persistence, including quote offset persistence and versioned analysis runs.
- `runPostInterviewAnalysis(interviewId)` is the server-only rerun entry point.
- `public.analysis_runs` preserves historical analysis runs instead of overwriting them.
- `public.persist_succeeded_analysis(uuid, jsonb)` atomically persists succeeded analysis output and enforces the six-objective-result invariant.
- Existing RLS functions use `auth.jwt() -> 'app_metadata' ->> 'role'` with `staff` and `admin` roles.
- Existing RLS allows staff/admin reads for interview, transcript, analysis, objective, quote, and theme records, while participant records are admin-only.
- `negative_reaction_flag` exists on `public.interviews`.
- `audio_storage_path` and `transcript_storage_path` exist, but Wave 6 must confirm private storage access mechanics before exposing audio/transcript files in the admin UI.
- The app has a service-role Supabase client for server-only workflows, but it does not yet have a Supabase Auth server-session helper for admin routes.

## Wave 6 Goal

Build the smallest safe authenticated Admin Review experience that lets authorized staff review one interview record at a time, inspect prior analysis runs, trace analysis evidence to transcript segments, set or confirm the negative reaction flag, and trigger a server-only analysis rerun that creates a new analysis record.

## Pre-Implementation Gates

Resolve these gates before coding:

1. **Supabase Auth route protection - resolved approach**
   - Add `@supabase/ssr` as a production dependency.
   - Add `lib/supabase/auth-server.ts` with a `createAuthenticatedSupabaseClient()` helper using `createServerClient` from `@supabase/ssr` to read session cookies in server components and server actions.
   - Add root `middleware.ts` for the `@supabase/ssr` App Router session refresh pattern on admin route requests, so expiring cookies are refreshed before later server queries rely on RLS.
   - Add `app/admin/login/page.tsx` as the minimum login route, using Supabase email/password sign-in and redirecting to `/admin` after success.
   - `requireStaffOrAdmin()` and `requireAdmin()` must call `supabase.auth.getUser()`, check `user.app_metadata.role`, and redirect unauthenticated users to `/admin/login`.
   - Admin review routes must reject unauthenticated users before any admin data query.

2. **Role and authorization semantics**
   - Confirm `app_metadata.role` remains the authoritative role source.
   - Confirm `/admin` access is allowed for `staff` and `admin`.
   - Confirm direct participant identifiers are available only to `admin`.
   - Default to `requireStaffOrAdmin()` for setting or confirming `negative_reaction_flag` unless this gate resolves to admin-only before implementation.
   - Default to `requireStaffOrAdmin()` for analysis reruns unless this gate resolves to admin-only before implementation.

3. **Admin read strategy - resolved approach**
   - Use the authenticated user-session Supabase client for all admin reads.
   - Existing RLS policies, including `interviews_staff_read`, `analysis_runs_staff_read`, and `participants_admin_read`, must enforce per-role access.
   - Do not use broad service-role reads for Admin Review pages.
   - Direct participant identifiers must be fetched through a separately named admin-only path, not included in default analytical records.
   - Browser code must never receive service-role credentials or raw privileged query helpers.

4. **Admin write strategy - resolved approach**
   - No write RLS policies currently exist on application tables.
   - Do not add broad write policies for Wave 6.
   - Use narrow server-side write mechanisms for required mutations:
     - a service-role RPC for updating `negative_reaction_flag`
     - the existing server-only `runPostInterviewAnalysis(interviewId)` entry point for reruns
   - Server actions must verify staff/admin authorization before invoking service-role writes.
   - Write actions must confirm the interview is accessible to the caller using the authenticated user-session client, which is gated by RLS, before invoking a service-role RPC or the analysis runner.
   - Do not use the service-role client for write-action accessibility checks.

5. **Private audio and transcript access**
   - Confirm bucket names, storage policy assumptions, and signed URL or server-route streaming approach.
   - Do not make interview audio or transcript files public.
   - If storage policies or buckets need schema changes, include a migration and regenerate DB types.

6. **Server-only rerun entry point**
   - Confirm Wave 6 rerun UI calls a server action or route handler that invokes `runPostInterviewAnalysis(interviewId)`.
   - Rerun must create a new analysis run and preserve prior runs.
   - Do not add bulk reruns, queues, background workers, or scheduled jobs in Wave 6 unless a gate proves the synchronous path is not viable.

7. **Negative reaction flag workflow**
   - Confirm whether the UI supports only setting/confirming `true`, or also clearing to `false`/`null`.
   - The implementation should keep this as interview metadata, not an inferred analysis output.
   - Add a service-role RPC such as `update_negative_reaction_flag(p_interview_id uuid, p_value boolean)` following the same security-definer and service-role-only grant pattern as Wave 5 RPCs.
   - Include the RPC in the Wave 6 migration and run `npm run db:types`.

8. **Cost display semantics**
   - Confirm how to present missing `estimated_cost_usd`, `input_tokens`, or `output_tokens`.
   - Do not infer cost values when they were not persisted.

9. **Transcript identity disclaimer**
   - Confirm admin copy states the system separates profile-level identifiers from analytical records and does not guarantee full transcript de-identification.

## Smallest Safe Implementation

### 1. Auth Foundation

Add a small server-only auth layer for admin routes:

- `requireStaffOrAdmin()`
- `requireAdmin()`
- a role type constrained to `staff | admin`
- `/admin/login` as a plain Supabase email/password sign-in route

Use it in admin pages and server actions before any privileged query. Keep service-role access server-only.

### 2. Admin Data Repository

Add a server-only admin repository that returns purpose-specific read models:

- interview list item
- interview detail
- analysis run history
- analysis run detail
- transcript segment references
- admin-only participant identity detail

Default interview detail must include confirmed non-identifying participant context but exclude direct participant identifiers. Fetch direct identifiers only through a separately named admin-only method, such as `loadParticipantIdentity(interviewId)`.

### 3. Admin Routes

Implement:

- `app/admin/page.tsx`
  - authenticated interview list
  - review status, interview lifecycle status, transcript status, latest analysis status, negative reaction flag, and timestamps
  - simple filtering by status only if it remains small and local to review workflow

- `app/admin/interviews/[interviewId]/page.tsx`
  - review header with interview status and technical quality flags
  - lifecycle, eligibility decision, consent version/timestamp, interview duration, and supporting metadata
  - confirmed non-identifying participant context by default
  - admin-only direct identity panel if the role gate confirms it
  - audio access if private signed access is confirmed
  - transcript segment list with stable segment anchors
  - analysis run history and selected run detail
  - prompt and document versions for both the interview and selected analysis run
  - six objective results with confidence, limitation text, and evidence links
  - quote verification status, accepted/rejected quote status, and persisted offsets
  - usage/cost metadata
  - negative reaction flag control
  - rerun analysis control

The default selected analysis run is the most recently created succeeded run. If no succeeded run exists, show the most recently created run of any status. List all prior runs in reverse-chronological order.

Keep the UI plain, utilitarian, and review-focused. Do not build a dashboard or aggregate analytics surface.

### 4. Server Actions

Add minimal server actions or route handlers for:

- setting or confirming `negative_reaction_flag`
- triggering `runPostInterviewAnalysis(interviewId)`
- generating signed audio access if that is the selected storage approach

All actions must:

- verify staff/admin authorization server-side
- verify the interview is accessible to the caller before mutating or rerunning it, using the authenticated user-session client rather than the service-role client
- avoid accepting direct participant identifiers from the browser
- revalidate affected admin pages after mutation
- report failed or ineligible reruns without overwriting existing analysis runs

### 5. Database Changes

Prefer no table changes for Wave 6.

Add a migration for the narrow `negative_reaction_flag` RPC, because no write RLS policy currently exists and the flag must be reviewer-controlled in Wave 6.

Only add additional migrations if a pre-implementation gate confirms another missing primitive is required, such as:

- private storage bucket/policy support
- a narrow RPC for an authorized metadata update
- a read helper that materially reduces privacy risk versus ad hoc joins

If migrations or RPC result shapes change, regenerate `types/database.types.ts`.

## Expected Changed Files

Planning file:

- `WAVE_6_IMPLEMENTATION_PLAN.md`

Expected implementation files in the Wave 6 branch:

- `app/admin/page.tsx`
- `app/admin/login/page.tsx`
- `app/admin/interviews/[interviewId]/page.tsx`
- `app/admin/actions.ts`
- `lib/admin/auth.ts`
- `lib/admin/repository.ts`
- `lib/admin/types.ts`
- `lib/supabase/auth-server.ts`
- `middleware.ts`
- `app/globals.css` for restrained admin UI styles
- `tests/admin-auth.test.ts`
- `tests/admin-repository.test.ts`
- `tests/admin-actions.test.ts`
- `tests/admin-boundaries.test.ts`
- `tests/admin-review-page.test.tsx` if page rendering tests are feasible in the existing Vitest setup
- `package.json` and lockfile for `@supabase/ssr`

Conditional files:

- `package.json` and lockfile for any additional test dependency if needed
- `.env.example` if new required auth/storage environment variables are introduced
- `supabase/migrations/*.sql` for the negative reaction flag RPC, and for storage or policy changes if required
- `types/database.types.ts` after the RPC migration and any other DB shape change

## Acceptance Criteria

Wave 6 is complete when:

- Admin review routes require Supabase Auth.
- Staff/admin users can access the Admin Review workflow.
- Unauthenticated users cannot access admin review data.
- Non-identifying participant context is shown by default.
- Direct participant identifiers are either omitted or shown only behind an admin-only authorization path.
- The UI clearly states that profile-level identifier separation is not full transcript de-identification.
- The review detail shows interview status and technical quality flags.
- The review detail shows lifecycle status, eligibility decision, consent version, consent timestamp, and interview duration.
- The review detail shows prompt and document versions, including `operating_principles_version`, `interview_guide_version`, and `live_prompt_version` from the interview, plus `analysis_prompt_version`, `output_specification_version`, and `structured_schema_version` from the selected analysis run.
- The review detail shows audio access when private access is safely confirmed.
- Private storage for audio and transcript files is inaccessible without authorization when storage access is implemented.
- The review detail shows transcript segments.
- The review detail shows per-interview summary, exactly six objective results, confidence, limitations, and quote verification status for a selected succeeded analysis run.
- Objective evidence and verified quotes trace back to transcript segments.
- Prior analysis runs are inspectable and not overwritten.
- Rerunning analysis uses the server-only Wave 5 runner and creates a new analysis run.
- The reviewer can set or confirm `negative_reaction_flag` according to the resolved gate.
- Usage and cost metadata are displayed without inference when values are missing.
- Service-role credentials and OpenAI API keys remain server-only.
- Tests cover authorization, identifier separation, rerun preservation, negative flag persistence, and transcript traceability.
- Lint, typecheck, tests, production build, and database validation pass.

## Tests To Add Or Update

Add focused tests for:

- unauthenticated admin access is blocked
- unauthenticated admin requests redirect to `/admin/login` rather than returning a 200 or blank response
- staff/admin admin access is allowed
- admin-only participant identity access is enforced
- default admin detail records exclude direct participant identifiers
- `app/admin/` code does not directly query participant name, email, GFOA member ID, or organization fields outside the admin-only identity path
- interview list and detail repository mapping
- consent version and timestamp appear in interview detail
- interview duration appears in interview detail
- prompt and document versions appear in interview and analysis run detail
- analysis run history preserves and orders prior runs
- selected succeeded analysis exposes exactly six objective results
- objective evidence maps to transcript segment IDs
- accepted quote segments include persisted offsets
- rejected or unmatched quotes do not masquerade as verified
- negative reaction flag action checks authorization and persists the requested value
- negative reaction flag action rejects unauthenticated and non-staff/admin callers
- rerun action checks authorization and calls the Wave 5 server-only runner
- rerun action rejects unauthenticated and non-staff/admin callers before invoking the runner
- rerun action creates or reports a new run without overwriting existing succeeded runs
- private storage access for audio/transcript fails without a valid authorized session, if storage access is implemented
- source-boundary checks that Wave 6 does not add dashboards, aggregate analytics, formal taxonomy, recommendations, or live interviewer changes

If a migration is added, include database validation coverage for any new policy, trigger, or RPC.

## Validation Commands

Run before opening a PR:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run db:reset
```

If migrations, generated DB types, or RPC shapes change, also run:

```powershell
npm run db:types
npm run typecheck
npm test
```

Manual smoke checks before PR:

- unauthenticated `/admin` is blocked
- staff user can review non-identifying interview detail
- admin user can access any approved identity reveal path
- objective evidence links focus the expected transcript segment
- accepted quote offsets display for verified quotes
- negative reaction flag update persists after reload
- rerun creates a new analysis run and prior runs remain visible
- service-role key, OpenAI key, and raw access tokens are absent from browser payloads and server logs
- for staff-role sessions, names, email addresses, GFOA member IDs, and organization names are absent from browser network responses

## Explicit Out Of Scope

Do not implement in Wave 6:

- cross-interview dashboards
- aggregate analytics
- formal theme taxonomy
- synthetic personas or decision agents
- recommendations
- exports or reporting packs
- bulk reruns
- background queues or scheduled analysis jobs unless required by a resolved rerun gate
- staff user management, invitations, or role administration screens
- broad visual polish beyond a usable admin review workflow
- editing model-generated analysis text
- manually overriding quote verification status
- transcript redaction as a completed privacy feature
- browser-only transcript capture changes
- live interviewer prompt/process changes
- weakening the server-enforced 20-minute cap
- Wave 7+ behavior

## Residual Risks

- The repo does not yet have Supabase Auth session helpers for App Router; Wave 6 will add `@supabase/ssr` and a minimal `/admin/login` route to close this gap.
- Private audio access depends on storage policy details that are not fully established in the current code.
- Synchronous rerun from the admin UI may be slow. If the server action or route handler times out before the Wave 5 runner completes, the pending analysis run may remain in `pending` status. This is recoverable; the run can be inspected and the interview rerun again. Set an appropriate timeout for the deployment environment, show a loading indicator during rerun, and surface timeout/error states alongside analysis run history.
- Transcript text can contain spoken identifiers. Wave 6 may explain this, but it must not claim transcript de-identification is solved.
- Cost fields may be incomplete; the UI must display missing cost metadata honestly.
