# MVP Stabilization And Readiness Plan

## Status

The predefined MVP build waves in the locked technical specification now run
from Wave 0 through Wave 6. This plan is not Wave 7 feature work. It is a
post-Wave-6 stabilization and readiness plan for deciding whether the MVP is
complete enough for a real end-to-end pilot path.

This plan was prepared after reviewing:

- `AGENTS.md`
- every file in `docs/locked/`
- the current `main` branch after Wave 6 Admin Review was merged

The locked documents remain binding. If this plan, an audit finding, or a
proposed bugfix conflicts with `docs/locked/`, stop and identify the conflict
before changing code or requirements.

## Goal

Determine whether the MVP satisfies the locked acceptance requirements and is
ready for realistic end-to-end test interviews. Any gaps should be fixed as
small stabilization or bugfix PRs, not as broad new feature waves.

The practical completion target is the locked MVP Completion Standard:

1. a participant can enter and confirm profile information;
2. consent is recorded before the interview begins;
3. the participant can complete or partially complete a voice interview;
4. the system creates a canonical segmented transcript;
5. the system runs evidence-gated post-interview analysis;
6. representative quotes are deterministically verified;
7. linked records are stored without duplicating direct identifiers into
   analytical output; and
8. an authorized reviewer can trace analysis back to transcript evidence.

## Explicit Non-Goals

Do not use this plan to implement:

- cross-interview dashboards or aggregate analytics;
- a formal theme taxonomy;
- synthetic personas or decision agents;
- recommendations;
- exports or public reporting;
- broad visual polish beyond basic participant and admin flows;
- staff/user-management screens;
- bulk reruns, queues, or scheduled analysis jobs unless required to fix a
  demonstrated MVP acceptance failure;
- post-MVP roadmap items before the MVP readiness audit is complete.

## Operating Method

Work in audit-first passes. Each pass should produce a short written result
before any code changes:

1. requirement or risk being checked;
2. evidence from code, migrations, tests, or manual run;
3. status: `pass`, `gap`, `blocked`, or `not_applicable`;
4. exact follow-up PR, if any;
5. commands run and results.

When a gap is found, create the smallest PR that fixes that gap and adds or
updates tests. Do not bundle unrelated gaps unless they share the same root
cause and can be fixed safely together.

Every stabilization PR should run:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

If migrations, RLS, RPCs, generated DB types, storage policy SQL, or Supabase
schema assumptions change, also run:

```powershell
npm run db:reset
npm run db:types
npm run typecheck
npm test
```

## Workstream 1: Full MVP Acceptance Audit

### Scope

Audit the current repo against the locked technical specification acceptance
tests, not only against Wave 6.

### Checklist

- Intake and identity:
  - matched member can confirm a profile;
  - unmatched participant can complete minimum intake;
  - profile correction does not update the authoritative membership source;
  - voice interviewer does not ask identity questions;
  - analytical records do not duplicate direct identifiers.
- Consent:
  - consent screen presents the required AI interviewer disclosure, recording
    notice, consent language, privacy or data-use notice, approximate
    15-minute length, and notice that continuation past the target requires
    participant agreement;
  - interview cannot begin without affirmative consent;
  - consent version and timestamp are stored.
- Live interview:
  - browser establishes a Realtime session without exposing a permanent API key;
  - microphone denial is handled;
  - elapsed-time and near-limit signals reach the interviewer;
  - participant may consent to continue past 15 minutes;
  - server-side control prevents sessions beyond 20 minutes;
  - browser teardown is a secondary safeguard;
  - completed, participant-ended, and technical-failure dispositions are
    recorded from observable signals.
- Transcript:
  - ordered final segments are canonical;
  - serialization is deterministic;
  - duplicate or missing sequence numbers fail validation;
  - analysis cannot cite non-final segments;
  - transcript stabilization records failure states clearly.
- Eligibility and analysis:
  - fewer than 40 participant-spoken words is retained but not analyzed;
  - sufficient word count without objective support is retained but not analyzed;
  - eligible early-ended sessions are analyzed with partial coverage where
    appropriate;
  - eligibility cites objective and canonical segment evidence;
  - unsupported fields remain `unclear`, `not_discussed`, null, or approved
    equivalents;
  - invalid JSON is not partially persisted;
  - failed analysis remains visible and rerunnable;
  - each succeeded analysis persists exactly six objective rows;
  - prior analysis runs remain available after rerun.
- Quotes:
  - exact quote matches canonical text;
  - case and whitespace variation are handled;
  - paraphrase fails verification;
  - accepted quotes resolve to exact source segments and persisted offsets.
- Admin and security:
  - unauthorized users cannot access admin routes;
  - staff can use the profile-separated review view;
  - direct identity access is admin-only;
  - reviewer can set or confirm `negative_reaction_flag`;
  - private storage is inaccessible without authorization;
  - service credentials remain server-only.
- Cost monitoring:
  - live usage events are captured through sideband;
  - live and analysis usage are recorded;
  - estimated cost is visible per interview;
  - abandoned and failed-session costs are distinguishable.

### Deliverable

Create an acceptance matrix that lists each item as `pass`, `gap`,
`blocked`, or `not_applicable`, with file/test/manual evidence and proposed
follow-up PRs.

## Workstream 2: Security And Privacy Review

### Scope

Review auth, authorization, RLS, storage, service-role boundaries, logs,
browser payloads, and identifier separation.

### Checklist

- Supabase Auth:
  - admin route protection uses verified user sessions;
  - role source remains `user.app_metadata.role`;
  - unauthenticated admin requests redirect or fail closed.
- RLS:
  - participants remain more tightly restricted than analytical records;
  - staff/admin read policies match intended review access;
  - no broad write policies were added as shortcuts;
  - service-role-only RPCs are narrow and tested.
- Service-role and OpenAI keys:
  - service-role credentials are imported only server-side;
  - OpenAI permanent keys are never sent to browser code;
  - browser Realtime credentials are short-lived or server-created.
- Direct identifiers:
  - names, emails, member IDs, and organization names are not duplicated into
    analytical tables, model analysis outputs, or default staff review models;
  - admin-only identity paths are named and gated;
  - transcript content is not described as fully de-identified.
- Storage:
  - audio and transcript buckets are private before any pilot;
  - signed URLs or streaming routes, if added, are short-lived and
    authorization-checked;
  - transcript files remain derived serializations, not authoritative sources.
- Logs:
  - production logs do not include raw access tokens, service keys, OpenAI
    keys, full participant profiles, or complete transcripts unless explicitly
    justified for a controlled diagnostic path.

### Deliverable

Create a security/privacy findings list ordered by severity. Fix only
material MVP risks before pilot. Track governance-workstream dependencies
separately.

## Workstream 3: Deployment Readiness Review

### Scope

Confirm the app can be configured and run against a real Supabase/OpenAI
environment without relying on local-only assumptions.

### Checklist

- Environment variables:
  - all required public and server env vars are documented;
  - missing env errors are understandable;
  - no secrets are committed.
- Supabase:
  - migrations apply from a clean database;
  - generated DB types match migrations;
  - Auth roles for test staff/admin users are created in `app_metadata`;
  - RLS policies are active in the target project;
  - required storage buckets exist and are private before media access is
    enabled.
- OpenAI:
  - Realtime and analysis model env vars are set;
  - permanent API key is server-only;
  - model usage and cost capture are observable.
- Runtime:
  - production build succeeds;
  - sideband worker/runtime deployment path is understood;
  - WebSocket and WebRTC requirements are documented for the target host;
  - timeout settings match the 15-minute target and 20-minute hard cap.
- Admin:
  - at least one admin and one staff test account can sign in;
  - staff/admin role differences can be smoke-tested.

### Deliverable

Create a deployment readiness checklist with exact env vars, Supabase setup
steps, storage-bucket decisions, and smoke-test accounts or account-creation
steps.

## Workstream 4: Realistic End-To-End Test Interviews

### Scope

Run controlled test interviews to prove the complete MVP path with real
browser audio, Realtime session setup, sideband capture, transcript
stabilization, analysis, quote verification, and admin review.

### Minimum Scenarios

- completed interview:
  - participant completes the six-objective flow;
  - transcript stabilizes;
  - analysis succeeds with exactly six objective rows;
  - quotes are accepted only when deterministically verified;
  - admin review can trace evidence to transcript segments.
- participant-ended interview:
  - participant leaves before closing;
  - disposition is `participant_ended`;
  - if content threshold is met, analysis runs with partial coverage;
  - if content threshold is not met, record is retained and not analyzed.
- technical failure:
  - simulate connection or sideband failure;
  - disposition/failure state is retained;
  - incomplete records are not treated as successful.
- browser succeeds, sideband fails:
  - browser WebRTC connection succeeds but the server-side sideband connection
    cannot be established;
  - the session does not proceed as a normal active interview;
  - the system retries only within a bounded window or terminates with
    `technical_failure`;
  - no interview is marked normally active unless both browser and sideband
    connections are established.
- time-limit behavior:
  - near-limit signal reaches the interviewer;
  - server-side hard cap prevents continuation beyond 20 minutes;
  - browser teardown acts as secondary safeguard.

### Evidence To Capture

- interview ID and participant ID;
- consent version and timestamp;
- Realtime call ID;
- browser and sideband connection states;
- transcript segment count and stability state;
- analysis run status and six-objective row count;
- quote verification status and offsets;
- at least one rejected, needs-review, or dropped nonmatching quote proposal
  path when a near-match or paraphrase is produced in testing;
- admin review screenshots or notes;
- observed failures and logs, excluding secrets and full profiles.

### Deliverable

Create an E2E test-interview report with scenario outcomes and follow-up PRs.

## Workstream 5: Stabilization PR Plan

### Scope

Convert audit findings into small implementation PRs. This is where code
changes happen.

### Classification

- `P0 blocker`: prevents safe MVP pilot or violates locked requirements.
- `P1 required`: needed before a real participant pilot, but not an immediate
  safety stop.
- `P2 stabilization`: improves reliability or operability without changing the
  MVP scope.
- `Post-MVP`: useful, but excluded from MVP or not required for pilot.

### PR Rules

- One root cause per PR where practical.
- Include focused tests with behavioral changes.
- Do not edit `docs/locked/` without explicit authorization.
- Preserve prompt versions, migration history, prior analysis runs, and
  analytical identifier boundaries.
- Do not introduce dashboards, aggregate analytics, formal taxonomies,
  recommendations, exports, or broad visual polish.

### Likely PR Areas

These are candidates only; the audit decides whether they are required:

- private Supabase Storage bucket setup and signed media access;
- deployment env documentation and validation cleanup;
- admin/staff test-user setup documentation;
- E2E test harness or manual runbook;
- hardening around logs and browser payload checks;
- production sideband worker deployment notes;
- project-level spending alert or budget-monitoring setup, at minimum as a
  `P2 stabilization` readiness item if no pilot-blocking budget control is
  required;
- fixes found during realistic test interviews.

## Completion Criteria

This stabilization phase is complete when:

- the full MVP acceptance matrix has no unresolved `P0 blocker` or `P1 required`
  gaps;
- security/privacy review has no material unresolved MVP risks;
- deployment readiness checklist is complete enough to configure a real target
  environment;
- at least one realistic completed end-to-end interview has produced a
  reviewable admin record with traceable analysis evidence;
- failure scenarios have been exercised or explicitly deferred with rationale;
- all stabilization PRs required for MVP pilot have passing lint, typecheck,
  tests, build, and database validation where applicable.

## Open Decisions

- Where will the first realistic MVP test run: local Supabase, hosted Supabase
  staging, or production-like staging?
- What data source will back membership lookup during pilot: mock directory,
  staging GFOA data, or real member data?
- What is the authoritative storage bucket naming convention for audio and
  transcript serializations?
- Who should have `admin` versus `staff` roles for pilot testing?
- What retention, transcript-content redaction, and governance rules must be
  decided before real participant data is collected?
- Is synchronous admin rerun acceptable for pilot, or does pilot readiness
  require an explicit timeout/runbook?
- What spending alert or budget monitor satisfies MVP cost-control readiness?
