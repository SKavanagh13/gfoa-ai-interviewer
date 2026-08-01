# AI Voice Interviewer MVP Technical Specification — Revised after Red-Team Review

## 1. Purpose

This specification translates the locked project documents into buildable requirements for an MVP AI voice interviewer.

The locked governing documents are:

1. AI Interviewer Operating Principles
2. AI Interviewer Guide
3. Per-Interview Output Specification
4. AI Voice Interviewer MVP Flow

The MVP must prove one complete end-to-end path:

1. Participant identity intake
2. Email confirmation
3. Consent and disclosure
4. Live voice interview
5. Canonical transcript creation
6. Post-interview analysis
7. Deterministic quote verification
8. Structured storage
9. Authorized review

Cross-interview analysis, dashboards, formal taxonomy development, synthetic personas, and broader reporting are outside the MVP.

---

## 2. Recommended Technology Stack

- Next.js App Router
- TypeScript with strict mode enabled
- Supabase Postgres
- Supabase Storage
- Supabase Auth for staff/admin access
- OpenAI Realtime API over WebRTC for the live interview
- Separate OpenAI structured-output call for post-interview analysis
- Vitest or equivalent for unit and integration tests
- Playwright or equivalent for critical end-to-end tests

The implementation should use version-controlled SQL migrations, prompt files, and schemas.

---

## 3. Repository Structure

Recommended starting structure:

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

The locked documents should be retained in the repository as versioned source files. The live and post-interview prompts may incorporate or reference them, but the locked source documents should remain separately inspectable.

---

## 4. Core Application Flow

### 4.1 Participant Intake

1. Participant opens the interview link.
2. Participant enters an email address.
3. The application attempts to match the email to the GFOA membership database.
4. The participant confirms the email address before proceeding.
5. If a match is found, the application may link available profile context to the interview record for authorized review and later analysis without asking the participant to confirm or correct profile fields during the MVP intake flow.
6. If no match is found, the application proceeds without collecting additional participant profile fields; missing profile fields remain null or “not collected.”
7. The voice interviewer does not ask for name, title, organization, government type, or similar administrative information.

The membership lookup should be implemented behind an abstraction so the MVP can begin with a mock or staging data source.

```ts
interface MemberDirectory {
  findByEmail(email: string): Promise<MemberMatch | null>;
}
```

### 4.2 Consent and Disclosure

Before the voice interview begins, the application must present:

- AI interviewer disclosure
- Recording notice
- Consent language
- Privacy or data-use notice
- Approximate 15-minute interview length
- Notice that the session may continue slightly longer only with participant agreement

The participant cannot begin the interview without affirmative consent.

Consent version and timestamp must be stored.

### 4.3 Live Voice Interview

The browser connects to the OpenAI Realtime API through WebRTC. The application server also opens a sideband WebSocket connection to the same Realtime session using the session call ID returned during session creation.

The browser connection handles participant audio and model audio. The server-side sideband connection is the durable control and event-capture path. It monitors the session, persists finalized transcript and usage events as they arrive, supplies timing and state updates, and enforces the hard session limit.

The live interviewer receives:

- the locked Operating Principles;
- the locked Interview Guide;
- confirmed participant context only when it materially improves orientation;
- objectives already sufficiently covered;
- objectives remaining;
- elapsed time or an application-generated timing signal;
- the current conversation state;
- a signal when the session approaches the 15-minute target;
- a hard-stop signal at 20 minutes.

The interviewer must not:

- search the web;
- call external tools;
- provide GFOA opinions or advice;
- ask administrative intake questions;
- continue beyond 20 minutes.

### 4.4 Time Management

The target duration is approximately 15 minutes.

The application must provide a near-limit signal early enough for the interviewer to:

- compress optional follow-ups;
- cover remaining objectives;
- deliver the time check-in required by the Operating Principles.

If the participant agrees to continue past 15 minutes, the session may continue only until the hard cap of 20 minutes.

At 20 minutes:

- the server-side sideband controller terminates or closes the Realtime session so additional model generation cannot continue;
- the browser also tears down its WebRTC connection as a participant-facing safeguard;
- the interviewer delivers a brief forced closing immediately before termination when technically possible;
- the session is finalized;
- the end disposition remains based on observable behavior and system events.

The server-side termination path is the authoritative enforcement mechanism. The browser timer is a secondary UX safeguard, not the sole control.

The 20-minute ceiling is a product-level cap, not merely a prompt instruction.

---

## 4.5 Live Session Topology and Durable Capture

The required MVP topology has two simultaneous connections to the same OpenAI Realtime session:

1. **Browser WebRTC connection**
   - sends participant audio;
   - receives model audio;
   - renders participant-facing connection and timing state;
   - may relay UI events but is not the authoritative transcript writer.

2. **Application-server sideband WebSocket connection**
   - connects using the Realtime call ID;
   - monitors server events for the life of the session;
   - incrementally persists finalized transcript segments;
   - captures available usage events and session metadata;
   - supplies or updates timing and interview-state instructions when needed;
   - enforces the 20-minute session termination;
   - records capture and control failures.

The server-side sideband connection must be established before the participant interview is considered active. If the browser WebRTC connection succeeds but the sideband connection cannot be established, the application must not proceed with the interview as a normal session. It should either retry within a bounded window or terminate with `technical_failure`.

Transcript and usage persistence must be idempotent using provider event identifiers or another deterministic deduplication key.

---

## 5. Interview Lifecycle

### 5.1 End Disposition

On interview end, record one observable end disposition:

- `completed` — the interviewer ran its closing;
- `participant_ended` — the participant left before the closing;
- `technical_failure` — the connection or a required component failed.

Do not infer why a participant ended early from connection behavior alone.

### 5.2 Analysis Eligibility

Analysis eligibility is based on transcript content, not end disposition.

A session is `eligible` only when both conditions are met:

1. The canonical transcript contains at least 40 participant-spoken words across finalized segments; and
2. At least one interview objective can be assigned `partial` or `sufficient` coverage based on direct transcript evidence identifying the participant's central point and at least one meaningful dimension such as why it matters, relevant context, a concrete example, reasoning, impact, or a tradeoff.

A session is `ineligible_insufficient_content` when either condition is not met.

The eligibility decision must identify the supporting objective and source segment or segments. It may be made by a narrowly scoped model classification step, but the output must conform to a strict schema and cite canonical segments. Word count alone is never sufficient.

Eligible early-ended sessions are analyzed and may receive partial coverage.

Ineligible sessions are retained but not analyzed.

### 5.3 Negative Reaction Metadata

A nullable `negative_reaction_flag` may be set by automated analysis or an authorized reviewer when the transcript indicates that the participant reacted negatively to the AI interview method itself.

This flag:

- is interview-experience metadata;
- is not a finding about public finance;
- must not propagate into objective results or the analytical dataset.

---

## 6. Canonical Transcript

Ordered `transcript_segments` are the canonical transcript.

Finalized transcript and usage events are persisted incrementally by the server-side sideband connection as they arrive. The system must not depend on an end-of-session browser upload for canonical capture.

Any transcript file stored in object storage is a serialization derived from those segments and is not an independent source of truth.

Each canonical segment should contain:

- segment ID;
- interview ID;
- sequence number;
- speaker;
- finalized text;
- start timestamp;
- end timestamp;
- provider event ID, when available;
- finalization status.

The application must define a deterministic serializer:

```ts
serializeTranscript(segments): string
```

All analysis, quote matching, and evidence references must operate against the same canonical segment text.

### 6.1 Transcript Stabilization

A transcript reaches stable state only after:

1. the interview has ended or the server has enforced the hard cap;
2. the sideband event stream has received the session-end signal or entered a bounded reconciliation timeout;
3. all finalized transcript events received before that point have been idempotently persisted;
4. duplicate provider events have been reconciled;
5. sequence continuity and finalization constraints have been validated.

The reconciliation timeout must be configurable and recorded. If stable state cannot be established, the interview is retained with a transcript-processing failure and is not sent for analysis until resolved.

---

## 7. Post-Interview Analysis Pipeline

The post-interview analysis is a separate server-side process.

Pipeline:

```text
Interview ends
→ transcript reaches stable state
→ minimum-content eligibility check
→ create pending analysis run
→ model produces structured output
→ JSON schema validation
→ evidence gating
→ deterministic quote verification
→ persist objective results and accepted quotes
→ mark analysis run succeeded or failed
```

The model receives:

- canonical transcript;
- locked Per-Interview Output Specification;
- strict JSON output schema;
- de-identified confirmed participant context;
- analysis prompt version;
- model version;
- output-specification version.

No structured field is required to carry a substantive value.

A coded value may be populated only when supported by a specific transcript statement. Otherwise use:

- `not_discussed`;
- `unclear`;
- null; or
- an equivalent approved value.

Invalid model output must not be partially persisted.

---

## 8. Quote Verification

The model proposes:

- quote text;
- transcript location;
- related objective or theme.

Quote exactness is enforced outside the model.

Verification uses a case- and whitespace-insensitive exact substring match over a contiguous span of canonical segment text.

Any proposed quote that does not match must be:

- dropped; or
- retained only as a flagged rejected proposal for authorized review.

The model's own assurance that a quote is exact is not verification.

---

## 9. Data Model

### 9.1 `participants`

Stores direct identity and confirmed profile linkage.

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

This table is tightly permissioned.

### 9.2 `interviews`

One row per interview session.

Suggested fields:

- `interview_id` UUID primary key
- `participant_id` foreign key
- `end_disposition`
- `analysis_eligibility`
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
- `technical_error`
- timestamps

### 9.3 `transcript_segments`

One row per canonical speaker turn or finalized segment.

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
- no quote or analysis evidence reference may point to a non-final segment.

### 9.4 `analysis_runs`

One row per analysis attempt.

Suggested fields:

- `analysis_id` UUID primary key
- `interview_id` foreign key
- `status` (`pending`, `succeeded`, `failed`)
- `analysis_model`
- `analysis_prompt_version`
- `output_specification_version`
- `structured_schema_version`
- `overall_summary`
- `primary_takeaway`
- `additional_issue`
- `overall_quality`
- `limitations`
- `raw_structured_output`
- `error_message`
- timestamps

Earlier analysis runs must never be overwritten.

### 9.5 `objective_results`

Every succeeded analysis must persist exactly six rows: one and only one row for each locked interview objective.

Objectives that were not addressed remain explicit rows with `not_covered`, `not_discussed`, `unclear`, or the corresponding approved coverage and structured values. Row absence must never represent non-coverage.

Suggested fields:

- `objective_result_id` UUID primary key
- `analysis_id` foreign key
- `objective`
- `narrative_summary`
- `coverage`
- `confidence`
- `structured_fields` JSONB
- `supporting_segment_ids` UUID array or normalized relation
- timestamps

### 9.6 `interview_quotes`

Suggested fields:

- `quote_id` UUID primary key
- `analysis_id` foreign key
- `interview_id` foreign key
- `quote_text`
- `source_segment_ids`
- `start_time_ms`
- `objective`
- `verification_status`
- `reason_selected`
- timestamps

### 9.7 Optional Lightweight Theme Assignments

A provisional theme-assignment table may be included only if needed by the locked output specification.

Do not build a formal taxonomy in the MVP.

---

## 9.8 Schema Invariants

The following are database and application invariants:

- a succeeded analysis has exactly six objective-result rows;
- the combination of `analysis_id` and `objective` is unique;
- absence of an objective-result row never means `not covered`;
- analysis eligibility must record the supporting objective and canonical segment IDs when eligible;
- canonical transcript segments are written incrementally and idempotently;
- analysis cannot begin until transcript stable state is recorded;
- the Realtime call ID and sideband connection status are retained on the interview or associated session-control record;
- a session cannot be marked normally active unless both browser and server-side connections have been established.

---

## 10. Identity and De-Identification Boundary

Direct identifiers remain in the participant and interview layer.

Analytical records use:

- participant identifier;
- interview identifier;
- non-identifying contextual attributes needed for analysis.

Names, emails, member IDs, and organization names must not be duplicated into objective results or analytical outputs.

This is profile-level identifier separation, not guaranteed transcript de-identification. Participants may speak names or other identifiers aloud.

Transcript-content redaction, retention, access rules, and formal de-identification are governance-workstream dependencies.

---

## 11. Prompt Architecture

### 11.1 Live Interviewer Prompt

The live prompt governs conversation only.

It incorporates:

- locked Operating Principles;
- locked Interview Guide;
- timing information;
- objective coverage state;
- confirmed participant context when useful;
- instructions not to provide advice or GFOA positions;
- the 20-minute hard ceiling.

### 11.2 Post-Interview Analysis Prompt

The analysis prompt governs extraction only.

It incorporates:

- locked Per-Interview Output Specification;
- canonical transcript;
- de-identified participant context;
- strict JSON schema;
- evidence-gating rules;
- quote-proposal rules.

The live interviewer and analysis model must remain separate processes.

---

## 12. Admin Review Screen

The MVP includes a plain authenticated staff interface.

Authorized reviewers should be able to inspect:

- participant/profile linkage, when permission allows;
- consent version and timestamp;
- lifecycle and eligibility;
- interview duration;
- prompt and document versions;
- canonical transcript;
- objective summaries;
- coverage and confidence;
- supporting transcript segments;
- accepted and rejected quote proposals;
- limitations;
- negative-reaction flag;
- analysis-run history;
- usage and estimated cost per interview.

The screen should allow an authorized reviewer to:

- set or confirm the negative-reaction flag;
- rerun failed or obsolete analyses;
- inspect prior analysis runs;
- trace important conclusions back to transcript evidence.

---

## 13. Security and Access Boundaries

Minimum MVP requirements:

- staff/admin routes require Supabase Auth;
- storage buckets are private;
- service-role credentials are server-side only;
- OpenAI permanent API keys are never exposed to the browser;
- browser Realtime sessions use short-lived or server-created session credentials;
- participant identity data is more tightly restricted than analytical output;
- row-level security policies are defined and tested;
- production logs must not expose raw access tokens, permanent API keys, or full participant profiles.

A complete privacy, retention, and governance policy is a separate workstream.

---

## 14. Usage and Cost Controls

The MVP must capture usage and cost data from the beginning.

Requirements:

- server-controlled model selection;
- no web or tool use during the live interview;
- concise interviewer response instructions;
- 15-minute target;
- 20-minute hard session ceiling;
- estimated model usage stored per interview;
- estimated live-interview cost stored per interview;
- estimated post-interview analysis cost stored per analysis run;
- abandoned and technical-failure session costs tracked separately;
- project-level spending alerts or budget monitoring;
- ability to compare lower-cost and full Realtime models during internal testing.

Cost monitoring should be observational during the MVP. It should not complicate the participant experience unless a hard project budget limit is reached.

---

## 15. Failure Handling

The system must preserve clear states for:

- microphone permission denied;
- profile lookup failed;
- consent not given;
- WebRTC connection failed;
- sideband connection failed;
- browser connection active without durable server capture;
- connection dropped;
- participant ended early;
- transcript event persistence failed;
- transcript incomplete;
- transcript stabilization or reconciliation failed;
- interview ineligible for analysis;
- analysis model call failed;
- JSON validation failed;
- quote verification failed;
- database persistence failed.

Failed or incomplete records must be retained with enough information to diagnose the failure.

Partial analysis output must not be treated as successful.

---

## 16. Acceptance Tests

At minimum, the MVP is not complete until the following are demonstrated.

### Intake and Identity

- participant can enter and confirm an email address;
- matched member can proceed without being asked to confirm or correct profile fields;
- unmatched participant can proceed without being asked to enter additional profile fields;
- membership lookup or later enrichment does not update the authoritative membership system;
- voice interviewer does not ask identity questions;
- analytical records do not duplicate direct identifiers.

### Consent

- interview cannot begin without affirmative consent;
- consent version and timestamp are stored.

### Live Interview

- browser establishes a Realtime session without exposing a permanent API key;
- microphone denial is handled;
- elapsed-time and near-limit signals reach the interviewer;
- participant may consent to continue past 15 minutes;
- session cannot exceed 20 minutes;
- completed, participant-ended, and technical-failure dispositions are recorded correctly.

### Transcript

- ordered final segments are canonical;
- serialization is deterministic;
- duplicate or missing sequence numbers fail validation;
- analysis cannot cite non-final segments.

### Eligibility and Analysis

- interview with fewer than 40 participant-spoken words is retained but not analyzed;
- interview with sufficient word count but no objective supported by a central point plus at least one meaningful dimension is retained but not analyzed;
- early-ended interview meeting both eligibility conditions is analyzed;
- eligibility output identifies supporting objective and canonical segment evidence;
- unsupported fields remain unclear or not discussed;
- invalid JSON is not partially persisted;
- failed analysis remains visible and rerunnable;
- every succeeded analysis persists exactly six objective-result rows;
- prior analysis remains available after reprocessing.

### Quotes

- exact quote matches canonical text;
- case and whitespace variation are handled;
- paraphrase fails verification;
- accepted quote resolves to exact source segments.

### Admin and Security

- unauthorized users cannot access admin routes;
- analysts can use a profile-separated view;
- authorized staff can view identity linkage;
- reviewer can set the negative-reaction flag;
- private storage is inaccessible without authorization;
- service credentials remain server-side.

### Cost Monitoring

- live usage events are captured through the server-side sideband connection;
- live and analysis usage is recorded;
- estimated cost is visible per interview;
- abandoned and failed-session cost is distinguishable;
- server-side termination enforces the 20-minute cap even if the browser timer stalls;
- browser teardown independently occurs as a secondary safeguard.

---

## 17. Build Waves

### Wave 0 — Repository Skeleton

- initialize app;
- strict TypeScript;
- lint, tests, build;
- environment validation;
- base folder structure;
- locked documents and prompt placeholders committed.

### Wave 1 — Database and Lifecycle

- migrations;
- enums and constraints;
- RLS foundations;
- generated TypeScript database types;
- lifecycle tests.

### Wave 2 — Intake and Consent

- member-directory abstraction;
- matched and unmatched email-only intake;
- email confirmation;
- consent and disclosure;
- interview creation.

### Wave 3 — Live Voice Session

- server-side Realtime session creation;
- capture and persistence of the Realtime call ID;
- browser WebRTC connection;
- server-side sideband WebSocket connection to the same session;
- incremental, idempotent persistence of finalized transcript and usage events;
- microphone handling;
- timing signals;
- authoritative server-side 20-minute termination;
- browser-side teardown safeguard;
- disposition recording;
- transcript stabilization and reconciliation.

### Wave 4 — Canonical Transcript

- finalized segment persistence;
- deterministic ordering and serialization;
- transcript stability logic;
- quote normalization and matching utilities.

### Wave 5 — Post-Interview Analysis

- eligibility check;
- strict schema;
- analysis-run lifecycle;
- evidence-gated persistence;
- deterministic quote verification;
- rerun support.

### Wave 6 — Admin Review

- authentication;
- interview and analysis review;
- transcript traceability;
- quote status;
- negative-reaction flag;
- usage and cost display.

Each wave should end with passing tests, typecheck, lint, production build, and a review of the diff against this specification.

---

## 18. Coding-Agent Working Rules

Codex and Claude Code should be instructed to:

1. Treat locked documents and this specification as requirements.
2. Inspect the repository before proposing changes.
3. Work in bounded waves and small units.
4. Identify requirement conflicts rather than silently resolving them.
5. Prefer the smallest implementation satisfying current acceptance criteria.
6. Avoid building future-wave features.
7. Add or update tests with every behavioral change.
8. Run tests, typecheck, lint, and production build before considering a task complete.
9. Preserve migrations, prompt versions, schema versions, and prior analysis records.
10. Summarize changed files, tests run, and unresolved risks after each implementation unit.

---

## 19. MVP Completion Standard

The MVP is complete when one real participant can:

1. enter and confirm an email address;
2. consent;
3. complete or partially complete a voice interview;
4. generate a canonical segmented transcript;
5. receive an evidence-gated post-interview analysis;
6. produce deterministically verified quotes;
7. store all linked records without duplicating identity into analytical output; and
8. allow an authorized reviewer to trace the analysis back to the transcript.

The MVP should prove the core capability before any investment in cross-interview analysis, dashboards, formal taxonomies, or synthetic decision models.
