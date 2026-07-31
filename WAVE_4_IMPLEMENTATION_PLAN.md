# Wave 4 Implementation Plan - Canonical Transcript

## Current Wave

Wave 4 - Canonical Transcript

This plan is bounded to the Wave 4 scope in
`docs/locked/05-ai-voice-interviewer-mvp-technical-specification.md`.

## Binding Inputs Reviewed

- `AGENTS.md`
- `docs/locked/01-ai-interviewer-operating-principles.md`
- `docs/locked/02-ai-interviewer-guide.md`
- `docs/locked/03-per-interview-output-specification.md`
- `docs/locked/04-ai-voice-interviewer-mvp-flow.md`
- `docs/locked/05-ai-voice-interviewer-mvp-technical-specification.md`
- Merged Wave 3 implementation on `main`

## Wave 4 Scope

Implement canonical transcript utilities and validation only:

- deterministic transcript segment ordering;
- deterministic `serializeTranscript(segments): string`;
- transcript sequence continuity validation;
- final-segment-only validation for analysis/evidence use;
- duplicate provider-event and duplicate sequence detection helpers;
- transcript stability validation logic that can be called after Wave 3
  sideband capture;
- quote text normalization utilities;
- deterministic exact quote matching over canonical segment text;
- source-span resolution for accepted exact matches;
- tests for all canonical transcript and quote utility behavior.

## Explicitly Out Of Scope

Wave 4 must not implement:

- post-interview eligibility classification;
- post-interview analysis model calls;
- JSON schema validation of model output;
- analysis-run lifecycle processing;
- persistence of objective results;
- persistence of quote verification decisions from model-proposed quotes;
- admin review UI;
- cross-interview dashboards or analytics;
- formal theme taxonomy;
- recommendation generation.

Important boundary: Wave 4 may implement quote normalization and exact-match
utilities. Wave 5 owns using those utilities against model-proposed quotes in
the post-interview analysis pipeline and persisting accepted, rejected, or
needs-review quote records.

## Material Conflicts Or Ambiguities

No material conflicts were identified among the locked documents.

Two scope boundaries need to stay explicit during implementation:

- **Finalized segment persistence appears in both Wave 3 and Wave 4.** Wave 3
  already persists finalized transcript segments incrementally from the
  sideband path. Wave 4 should not replace that runtime capture path. Wave 4
  should add canonical ordering, serialization, validation, and reconciliation
  utilities used by the capture and later analysis layers.
- **Quote verification appears in the output specification and later pipeline.**
  Wave 4 should implement deterministic quote-normalization and exact-match
  primitives only. Wave 5 should decide when to run them against model-proposed
  quotes and how to persist verification status.

## Proposed Implementation

### 1. Branch

Create a fresh branch from updated `main`:

```bash
git checkout main
git pull --ff-only origin main
git checkout -b codex/wave-4-canonical-transcript
```

### 2. Canonical Transcript Types

Add `lib/transcript/types.ts` or `lib/interview/transcript-types.ts`.

Responsibilities:

- define a narrow canonical transcript segment input shape compatible with
  `transcript_segments`;
- define speaker, sequence, timestamp, and finalization fields used by
  transcript utilities;
- avoid coupling utilities to Supabase client types where pure functions are
  sufficient.

The utility input type should include:

- `segmentId`;
- `interviewId`;
- `sequenceNumber`;
- `speaker`;
- `text`;
- `startTimeMs`;
- `endTimeMs`;
- `providerEventId`;
- `isFinal`.

### 3. Deterministic Ordering

Add a pure helper such as:

```ts
orderTranscriptSegments(segments): OrderedTranscriptSegment[]
```

Rules:

- sort by `sequenceNumber` ascending;
- use stable tie-breakers only for diagnostics, not to mask duplicate sequence
  numbers;
- never infer missing segments;
- never silently discard duplicate segments.

### 4. Transcript Validation

Add pure validation helpers such as:

```ts
validateTranscriptForCanonicalUse(segments): TranscriptValidationResult
```

Validation should detect:

- no segments;
- non-final segments;
- duplicate `sequenceNumber`;
- missing sequence numbers;
- duplicate `providerEventId` when non-null;
- blank segment text;
- invalid timestamp order;
- mixed `interviewId` values in one transcript input.

Validation output should be structured enough for repositories or later waves
to store a clear `transcript_processing_error`, but Wave 4 should not begin
analysis eligibility processing.

### 5. Deterministic Serialization

Add:

```ts
serializeTranscript(segments): string
```

Rules:

- require successful canonical validation before serialization;
- sort by `sequenceNumber`;
- include speaker labels deterministically;
- include one segment per line or another stable, documented format;
- preserve the exact finalized segment text inside the serialized output;
- avoid timestamps in the canonical text unless they are needed for source
  references, because quote matching must operate on the same segment text used
  as evidence.

Recommended format:

```text
[0001] participant: Finalized participant text.
[0002] interviewer: Finalized interviewer text.
```

The exact format must be documented in code tests so later Wave 5 analysis and
quote matching use the same canonical string.

Important contract for Wave 5: `serializeTranscript` is the deterministic
human-readable transcript and analysis-model context format. Quote matching does
not operate on this serialized string with sequence and speaker prefixes.
Quote matching operates on the underlying canonical segment `text` fields, or a
documented normalized concatenation of adjacent segment text fields when
multi-segment matching is explicitly supported.

### 6. Segment Text Normalization

Add small deterministic text helpers, for example:

```ts
normalizeForExactMatch(text): string
```

Rules:

- case-insensitive;
- whitespace-insensitive;
- preserve punctuation and word order;
- do not paraphrase;
- do not remove meaningful words;
- document any Unicode normalization choice.

This helper is for deterministic matching only. It should not mutate stored
transcript text.

### 7. Quote Matching Utilities

Add:

```ts
findExactQuoteInTranscript(segments, quoteText): QuoteMatchResult
```

Rules:

- use normalized canonical segment `text` fields, not the serialized transcript
  string with `[0001] speaker:` prefixes;
- accept case and whitespace variation;
- require an exact contiguous substring match after normalization;
- reject paraphrases;
- return source segment IDs and offsets or segment-local spans sufficient for
  later persistence;
- support matches that span adjacent segments only if the serialized canonical
  text makes that span deterministic and source segments can be traced
  unambiguously.

Recommended smallest implementation:

- support exact matches within a single final segment first;
- support contiguous multi-segment matches only if tests define the behavior
  clearly and source segment IDs remain exact;
- return `no_match` rather than guessing.

### 8. Repository Integration

Add mandatory integration to `lib/interview/session-repository.ts` so stable
transcript state means the locked specification's stability requirements have
been enforced.

Required additions:

- load final transcript segments for an interview in canonical order;
- make `markTranscriptStable` load the interview's transcript segments and call
  `validateTranscriptForCanonicalUse` before writing `transcript_status =
  'stable'`;
- if validation fails, `markTranscriptStable` must not write `stable`; it should
  record `transcript_status = 'failed'` with a deterministic validation error
  through the existing transcript failure path.

Keep this scoped:

- do not start analysis;
- do not create analysis runs;
- do not write quote verification outcomes;
- do not duplicate direct identifiers into analytical records.

### 9. Database Changes

Expected default: no database migration is required.

Existing Wave 1 schema already has:

- `transcript_segments.sequence_number`;
- `transcript_segments.is_final`;
- unique `(interview_id, sequence_number)`;
- partial unique index on `(interview_id, provider_event_id)`;
- final-segment validation triggers for evidence tables;
- `interviews.transcript_status`;
- `interviews.transcript_processing_error`;
- `interviews.transcript_reconciliation_timeout_ms`.

Add a migration only if implementation requires a field not already represented
by the locked schema. If a migration is added, run `npm run db:types` and commit
the generated types.

### 10. Tests

Add or update tests for:

- deterministic ordering independent of input order;
- serialization output is stable;
- serialization rejects non-final segments;
- duplicate sequence numbers fail validation;
- missing sequence numbers fail validation;
- duplicate non-null provider event IDs fail validation;
- blank segment text fails validation;
- mixed interview IDs fail validation;
- invalid timestamp order fails validation;
- final segment validation passes for well-formed transcripts;
- quote matching accepts case variation;
- quote matching accepts whitespace variation;
- quote matching rejects paraphrase;
- quote matching returns exact source segment IDs;
- quote matching does not treat model-proposed quotes as verified by itself;
- no direct participant identifiers are introduced into transcript utilities or
  analytical tables.

### 11. Validation Before Completion

Run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run db:reset
```

Run `npm run db:types` if any migration or RPC shape changes generated database
types.

If a real Wave 3 transcript record is available locally or in staging, perform a
manual smoke test:

- load final transcript segments;
- validate canonical transcript;
- serialize transcript;
- exact-match a known quote;
- reject a paraphrase of the same quote.

## Suggested PR Review Focus

Ask review to focus on:

- deterministic transcript serialization is stable and documented by tests;
- validation does not silently repair missing, duplicate, non-final, or
  cross-interview segments;
- quote matching is deterministic exact matching, not semantic matching;
- quote utilities do not persist verification outcomes prematurely;
- analysis eligibility and post-interview analysis remain out of scope;
- browser-only transcript capture is not made authoritative;
- direct identifiers remain out of analytical records;
- existing Wave 3 sideband capture remains authoritative for finalized segment
  persistence.

## Expected Changed Areas

Likely files and folders:

- `lib/interview/` or `lib/transcript/`;
- `tests/`;
- `lib/interview/session-repository.ts` if repository integration is needed;
- `types/database.types.ts` only if a migration is needed;
- `supabase/migrations/` only if a database shape change is justified.

## Residual Risks

- Exact quote matching across segment boundaries needs careful source-span
  design. The smallest safe Wave 4 implementation should prefer clear
  single-segment matching unless multi-segment behavior is unambiguous.
- The canonical serialization format will become a contract for Wave 5
  analysis and quote evidence. It should be reviewed before implementation
  proceeds.
- Real Realtime transcript event shapes may produce segment text with spacing or
  punctuation quirks. Utility tests should cover realistic examples once
  available.
