# Wave 5 Implementation Plan - Post-Interview Analysis

## Current Wave

Wave 5 - Post-Interview Analysis

This plan is bounded to the Wave 5 scope in
`docs/locked/05-ai-voice-interviewer-mvp-technical-specification.md`.

## Binding Inputs Reviewed

- `AGENTS.md`
- `docs/locked/01-ai-interviewer-operating-principles.md`
- `docs/locked/02-ai-interviewer-guide.md`
- `docs/locked/03-per-interview-output-specification.md`
- `docs/locked/04-ai-voice-interviewer-mvp-flow.md`
- `docs/locked/05-ai-voice-interviewer-mvp-technical-specification.md`
- Merged Wave 4 canonical transcript utilities on `main`
- Existing Wave 1 database tables and triggers for:
  - `analysis_runs`
  - `objective_results`
  - `objective_result_segments`
  - `interview_quotes`
  - `interview_quote_segments`
  - `analysis_eligibility_segments`
  - `theme_assignments`
  - stable-transcript gating
  - exactly-six-objective-results enforcement
  - final transcript segment evidence enforcement
- Current OpenAI official documentation for Structured Outputs and Responses
  API usage:
  - https://platform.openai.com/docs/api-reference/responses
  - https://platform.openai.com/docs/guides/structured-outputs

## Wave 5 Scope

Implement the post-interview analysis pipeline only:

- stable-transcript precondition before analysis;
- canonical transcript loading and serialization for analysis input;
- minimum-content eligibility check;
- narrow eligibility model classification with strict schema;
- analysis-run lifecycle;
- post-interview analysis prompt and strict output schema;
- OpenAI structured-output call for post-interview extraction;
- application-level structured-output validation;
- evidence gating against canonical final transcript segments;
- deterministic quote verification using Wave 4 quote utilities;
- persistence of accepted and rejected quote proposals;
- persistence of exactly six objective-result rows on successful analysis;
- preservation of raw model output, prompt/schema/model versions, and failed
  analysis attempts;
- rerun support by creating a new analysis run rather than overwriting an old
  one.

## Explicitly Out Of Scope

Wave 5 must not implement:

- admin review UI;
- staff/admin authentication screens;
- cross-interview dashboards or analytics;
- a formal theme taxonomy;
- automated recommendations for GFOA, GovFi Solutions, or others;
- synthetic personas or decision agents;
- live interviewer prompt changes beyond metadata already produced in earlier
  waves;
- browser-only transcript capture;
- changes that weaken the server-enforced 20-minute live-session cap;
- overwriting historical analysis runs.

Wave 5 may persist analysis records that Wave 6 later displays. It should not
build the Wave 6 review interface.

## Material Conflicts Or Ambiguities

No direct conflicts were identified among the locked documents.

The following implementation boundaries need explicit handling:

1. **Eligibility is not word-count-only.** The technical specification requires
   at least 40 participant-spoken words and at least one substantively
   addressed objective supported by direct transcript evidence. The second
   condition may be decided by a narrowly scoped model classifier, but it must
   return a strict structured result and cite canonical segments.
2. **The analysis model proposes quotes, but does not verify them.** Quote
   verification must be deterministic and external to the model. The model's
   assertion that a quote is exact is never accepted as verification.
3. **The existing quote schema does not currently store source text offsets.**
   Wave 4 returns segment-local offsets. To make accepted quotes traceable,
   Wave 5 should add offset columns to `interview_quote_segments` rather than
   storing offsets only in application memory.
4. **The succeeded-analysis trigger requires exactly six objective rows before
   `analysis_runs.status` becomes `succeeded`.** The implementation must insert
   the pending analysis run, validate output, insert exactly six objective
   rows and evidence references, persist verified quote outcomes, then mark the
   run succeeded. Invalid output must not be partially treated as successful.
5. **Theme assignments are optional and lightweight.** The locked MVP permits
   lightweight labels but excludes a formal taxonomy. Wave 5 may persist a
   small number of transcript-supported labels if the schema and evidence
   validation are clear, but it must not create a taxonomy or aggregation
   framework.

## Pre-Implementation Gates

Resolve these before coding Wave 5:

1. **Confirm OpenAI structured-output request contract.**
   - Confirm whether this project should use `POST /v1/responses` with
     `text.format: { type: "json_schema", name, schema, strict: true }`, or
     another officially documented structured-output shape.
   - Confirm that the selected `OPENAI_ANALYSIS_MODEL` supports Structured
     Outputs with `strict: true`.
   - Confirm the response extraction path for the parsed JSON result.
   - Confirm refusal/error handling for strict structured outputs.
   - Keep tools disabled. The post-interview model should extract from the
     supplied transcript and locked output spec only.
2. **Confirm analysis model and environment variables.**
   - Add a server-only `OPENAI_ANALYSIS_MODEL`.
   - Add version constants or env-backed values for:
     - analysis prompt version;
     - output specification version;
     - structured schema version.
   - Keep the live Realtime model and post-interview analysis model separate.
3. **Confirm transaction strategy.**
   - Atomic multi-table writes are required for eligibility recording and
     succeeded-analysis persistence.
   - The implementation must use SQL RPCs, explicit transaction RPCs, or
     another proven transaction mechanism that cannot commit a partial
     successful analysis result.
   - Sequential Supabase client writes are not sufficient for the successful
     analysis persistence path unless they are wrapped by a proven transaction
     boundary.
   - Recommended mechanism: add small SQL RPCs for eligibility recording and
     succeeded analysis persistence.
4. **Confirm quote offset persistence.**
   - Recommended migration: add `start_offset` and `end_offset` to
     `interview_quote_segments`.
   - Accepted quotes must have deterministic source segment references and
     offsets.
   - Every retained non-match must be persisted as `rejected`; rejected
     proposals may omit offsets but must retain the proposed quote text and
     rejected status for later authorized review.
5. **Confirm rerun entry point.**
   - Recommended smallest Wave 5 entry point is a server-only function such as
     `runPostInterviewAnalysis(interviewId)`.
   - Do not build admin UI. Wave 6 can call the same server function from an
     authenticated review screen.

## Proposed Implementation

### 1. Branch

Create a fresh branch from updated `main`:

```bash
git checkout main
git pull --ff-only origin main
git checkout -b codex/wave-5-post-interview-analysis
```

### 2. Database Migration

Expected migration:

- Add `start_offset integer` and `end_offset integer` to
  `public.interview_quote_segments`.
- Add checks that offsets are nonnegative when present and `end_offset` is
  greater than `start_offset` when both are present.
- Add a trigger or constraint that accepted quote segment rows have offsets.
  If that is awkward in SQL because status lives on `interview_quotes`, use an
  application invariant with tests and a source-boundary test.
- Add RPC functions or another explicit transaction mechanism for atomic
  writes:
  - `record_analysis_eligibility(...)`
  - `persist_succeeded_analysis(...)` or a narrower equivalent

Run `npm run db:types` after any migration or RPC shape change.

### 3. Strict Output Schema

Replace the Wave 0 placeholder at
`schemas/post-interview-output.schema.json` with a strict schema compatible
with OpenAI Structured Outputs.

Rules:

- top-level type is `object`;
- every object uses `additionalProperties: false`;
- every property is listed in `required`;
- nullable fields use `type: ["string", "null"]` or equivalent supported
  nullable representation;
- enums mirror existing database enums where possible;
- unsupported JSON Schema keywords are avoided or enforced in application
  validation instead.

Recommended top-level shape:

- `overview`
  - `overall_summary`
  - `primary_takeaway`
  - `notable_additional_issue`
- `objective_results`
  - array of objective result objects
  - app validation enforces exactly one row for each of the six locked
    objectives
- `cross_cutting_themes`
  - `key_tension`
  - `recurring_concern`
  - `opportunity_signal`
  - `emerging_signal`
- `topic_tags`
  - lightweight plain-language labels with supporting segment IDs
  - no formal taxonomy
- `representative_quotes`
  - up to three proposed quotes
  - deterministic verification happens after model output
- `overall_quality`
- `limitations`
- `negative_reaction_flag`
  - boolean or null
  - if implemented, store only on `interviews.negative_reaction_flag`
  - never propagate into objective results or analytical datasets

Recommended objective result shape:

- `objective`
- `narrative_summary`
- `coverage`
- `confidence`
- `structured_fields`
  - generic array of `{ field_name, value, value_status }`
  - app validation maps allowed field names by objective into
    `objective_results.structured_fields`
- `supporting_segment_ids`

Use application validation to enforce:

- exactly six objectives;
- no duplicate objectives;
- allowed structured field names per objective;
- unsupported objective fields use `not_discussed`, `unclear`, or null;
- supporting segment IDs exist, are final, and belong to the same interview;
- any substantive narrative or structured value has transcript evidence;
- raw model output is preserved even when validation fails.

### 4. Eligibility Schema And Classifier

Add a separate narrow eligibility schema and prompt.

The deterministic part:

- load canonical final transcript segments;
- require `interviews.transcript_status = "stable"`;
- validate canonical transcript with Wave 4 utilities;
- count participant-spoken words across finalized participant segments;
- if fewer than 40 participant words, record
  `analysis_eligibility = "ineligible_insufficient_content"` and do not create
  an analysis run.

The model-classified part:

- only run if the 40-word threshold passes;
- ask a narrow classifier whether at least one objective has partial or
  sufficient coverage based on direct transcript evidence;
- the classifier prompt must not produce narrative summaries, coded
  structured fields, representative quotes, quote proposals, or full analysis
  output;
- require:
  - `eligible: boolean`;
  - `supporting_objective`;
  - `supporting_segment_ids`;
  - short rationale;
- validate cited segment IDs against the canonical transcript;
- if no supported objective is cited, record ineligible and do not create an
  analysis run.

For eligible interviews:

- insert supporting rows into `analysis_eligibility_segments`;
- update `interviews.analysis_eligibility`;
- update `analysis_eligibility_supporting_objective`;
- update `analysis_eligibility_decided_at`;
- then proceed to create a pending analysis run.

### 5. Post-Interview Prompt

Replace the placeholder at `prompts/post-interview-analysis.system.md`.

The prompt must:

- govern extraction only;
- explicitly state that it is separate from the live interviewer;
- incorporate or reference the locked Per-Interview Output Specification;
- require transcript-supported output only;
- require `not_discussed`, `unclear`, or null when support is absent;
- prohibit inferring protected or personal characteristics;
- prohibit recommendations;
- prohibit claims that one participant represents a broader group;
- require exactly six objective results;
- require proposed quotes to be exact excerpts from the transcript but state
  that deterministic verification outside the model is authoritative;
- require source segment IDs for objective evidence, themes, and proposed
  quotes;
- keep direct identifiers out of analytical output.

### 6. OpenAI Analysis Client

Add a server-only analysis client, likely `lib/openai/analysis.ts`.

Responsibilities:

- call the separate analysis model using `OPENAI_ANALYSIS_MODEL`;
- use the strict structured-output schema;
- provide:
  - canonical serialized transcript produced by the Wave 4
    `serializeTranscript` utility;
  - segment ID map or segment-index table;
  - locked output-spec content or versioned prompt reference;
  - approved non-identifying participant context only;
  - prompt/schema/model versions;
- disable model tools;
- return raw response, parsed JSON, usage, and refusal/error state.

The serialized transcript is the model input format. Deterministic quote
verification must still operate on canonical segment `text` fields through the
Wave 4 quote-matching utility, not on serialized prefixes or speaker labels.

The implementation should use direct `fetch` or the official OpenAI SDK only
after the request and response contract is confirmed from official docs. If a
new dependency is added, keep it narrowly justified.

### 7. Analysis Validation

Add application validators in `lib/analysis/`.

Recommended modules:

- `types.ts`
- `schema.ts`
- `eligibility.ts`
- `output-validation.ts`
- `evidence.ts`
- `quote-verification.ts`
- `repository.ts`
- `runner.ts`

Validation responsibilities:

- parse and validate strict schema output;
- enforce exactly six objectives;
- enforce one result per locked objective;
- validate coverage and confidence enum values;
- validate objective-specific structured fields;
- require source segment IDs for substantive claims;
- verify cited segments exist, are final, and belong to the interview;
- reject outputs that cite non-existent, non-final, or cross-interview
  segments;
- reject or fail the run when model output is malformed;
- avoid partial success.

### 8. Evidence-Gated Persistence

Add repository methods that use the service-role client server-side only.

Persistence flow:

1. Load interview, participant context, and canonical transcript.
2. If transcript is not stable, stop before model calls.
3. Run eligibility.
4. If ineligible, persist eligibility decision and stop.
5. Create a new `analysis_runs` row with `status = "pending"`.
6. Call the analysis model.
7. Preserve raw structured output and usage on the analysis run.
8. Validate output and evidence.
9. Insert exactly six `objective_results` rows.
10. Insert `objective_result_segments` rows.
11. Verify proposed quotes deterministically.
12. Insert `interview_quotes` rows with:
    - `accepted` for exact deterministic matches;
    - `rejected` for all retained non-matches, paraphrases, unsupported
      cross-segment proposals, or malformed proposals.
13. Insert `interview_quote_segments` rows with source offsets for accepted
    quotes.
14. Optionally insert lightweight `theme_assignments` and evidence rows.
    Absence of theme assignments, or failure to persist optional theme
    assignments, must not cause an otherwise valid six-objective analysis to
    fail or be treated as partial success.
15. Update analysis run overview fields and status to `succeeded`.
16. On model, schema, evidence, quote-verification, or database failure, mark
    the run `failed` with a deterministic error message.

Important invariants:

- a succeeded run has exactly six objective rows;
- historical analysis runs are never overwritten;
- reruns create new analysis rows;
- invalid model output is not partially persisted as success;
- direct participant identifiers are not inserted into objective results,
  quotes, themes, or raw analytical summaries beyond transcript content that
  the participant may have spoken.

### 9. Quote Verification

Use the Wave 4 `findExactQuoteInTranscript` utility.

Rules:

- quote matching operates on canonical segment `text`, not serialized
  transcript prefixes;
- matching is case- and whitespace-insensitive exact substring matching;
- punctuation and word order are preserved;
- paraphrases fail;
- the model's proposed source location is advisory only;
- deterministic matching result controls persistence status;
- accepted quotes persist exact source segment IDs and offsets;
- every retained non-match is `rejected`;
- rejected quote proposals may be retained for review but must not be
  presented as verified or partially accepted.

Smallest safe behavior:

- accept single-segment exact matches supported by Wave 4;
- reject cross-segment proposals until multi-segment matching is explicitly
  implemented and tested;
- do not guess source spans.
- do not use `needs_review` as a quote verification status in Wave 5; a human
  review display flag can be designed in Wave 6 without creating a middle
  verification state.

### 10. Rerun Support

Implement rerun support as repeated calls to the same server-side runner:

- each invocation creates a new `analysis_runs` row after eligibility passes;
- prior runs remain unchanged;
- prompt version, schema version, model version, raw output, usage, and error
  state are preserved per run;
- Wave 6 can expose this through the admin UI later.

### 11. Cost And Usage

Capture analysis usage from the OpenAI response when available:

- `estimated_input_tokens`;
- `estimated_output_tokens`;
- `estimated_analysis_cost_usd` if a deterministic project-local pricing
  constant is defined.

If exact pricing is not yet defined, persist token counts and leave cost null
rather than inventing a price.

### 12. Tests

Add or update tests for:

- strict schema has `additionalProperties: false` on all objects;
- strict schema does not allow undeclared properties;
- output validation rejects missing objectives;
- output validation rejects duplicate objectives;
- output validation rejects more or fewer than six objective results;
- output validation accepts exactly one result for each locked objective;
- unsupported fields are represented as `not_discussed`, `unclear`, or null;
- cited segment IDs must exist, be final, and belong to the same interview;
- eligibility rejects transcripts with fewer than 40 participant words;
- eligibility does not treat word count alone as sufficient;
- eligibility accepts a classifier result only when it cites a valid objective
  and canonical segment evidence;
- ineligible interviews are retained and not analyzed;
- pending analysis run is created only for eligible stable transcripts;
- unstable transcripts do not begin analysis;
- eligibility classifier output remains narrow and cannot include narrative
  summaries, structured coded fields, or quote proposals;
- invalid model JSON or schema output marks the run failed;
- successful analysis inserts exactly six objective rows;
- successful analysis persistence uses an atomic transaction boundary;
- database trigger rejects succeeded runs with fewer or more than six
  objective rows;
- rerun creates a new analysis run and does not overwrite the prior run;
- quote verification accepts exact case/whitespace variants;
- quote verification rejects paraphrases;
- accepted quote persists source segment IDs and offsets;
- retained non-matching quote proposal is persisted as rejected and is not
  treated as verified;
- no direct participant identifiers are duplicated into analytical tables by
  repository code;
- live interviewer and post-interview analysis remain separate model calls.

### 13. Validation Before Completion

Run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run db:reset
```

Run this as well if a migration, enum, RPC, or generated type shape changes:

```bash
npm run db:types
```

If a local real or fixture transcript exists, also perform a manual smoke test:

1. mark transcript stable;
2. run eligibility;
3. create pending analysis run;
4. run structured-output analysis;
5. validate evidence;
6. verify a known exact quote;
7. reject a paraphrase;
8. confirm exactly six objective rows;
9. rerun analysis and confirm the prior run remains unchanged.

## Suggested PR Review Focus

Ask review to focus on:

- eligibility requires both participant word count and objective support;
- analysis never starts unless transcript status is stable;
- strict output schema reflects the locked Per-Interview Output
  Specification without allowing unsupported invention;
- application validation enforces exactly six objectives and valid evidence;
- successful persistence is all-or-failed, not partial success;
- quote verification is deterministic and external to the model;
- accepted quotes persist traceable source segments and offsets;
- rejected quotes are not treated as verified;
- direct identifiers are not duplicated into analytical records;
- historical analysis runs and version metadata are preserved;
- live interviewer and post-interview analysis remain separate processes;
- no Wave 6 admin UI or cross-interview analytics were introduced.

## Expected Changed Areas

Likely files and folders:

- `schemas/post-interview-output.schema.json`
- `prompts/post-interview-analysis.system.md`
- `lib/analysis/`
- `lib/openai/analysis.ts`
- `lib/server-env-core.ts`
- `lib/server-runtime-env.ts`
- `.env.example`
- `supabase/migrations/`
- `types/database.types.ts`
- `tests/`

## Residual Risks

- Strict structured-output schemas have a limited supported JSON Schema subset;
  this must be reconfirmed immediately before implementation, including support
  by the selected `OPENAI_ANALYSIS_MODEL`.
- Eligibility's second condition is deliberately semantic but narrow. The
  classifier prompt and schema must avoid becoming a full analysis step.
- Atomic multi-table persistence is the main data-integrity risk. Prefer
  database RPC functions or another explicit transaction boundary; successful
  analysis persistence must not use unwrapped sequential writes.
- The existing Wave 4 quote matcher accepts single-segment matches only.
  Cross-segment quote proposals should be rejected until deterministic
  multi-segment matching is implemented and reviewed.
- Automated negative-reaction classification is allowed by the technical spec
  but not central to Wave 5. If included, it must remain interview-experience
  metadata and never enter objective results.
