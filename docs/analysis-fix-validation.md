# Analysis Fix Validation

Scope: post-Wave-6 stabilization of per-interview analysis. Current prompt is `wave5-post-interview-analysis-v5`; current runtime schema is `wave5-post-interview-output-v4`.

## Changes

- The generation schema constrains each coded field to one permitted category, or null with an explicit uncertainty status. It derives these constraints from the existing application coding constants. The v3 JSON source schema remains intact; `lib/analysis/schema.ts` builds the v4 generation schema from it.
- The request includes the full locked output specification and the recorded end disposition. Deployment file tracing includes both required prompt sources.
- Prompt instructions require direct participant evidence, avoid inferred adoption/timing/impact labels, distinguish additional issues, calibrate confidence, note transcript limitations, and copy contiguous quote text.
- Evidence validation rejects interviewer/system citations and empty tag/quote evidence. Supported fields cannot have empty values or lack substantive objective coverage.
- The previous v4 prompt is preserved in `prompts/versions/`. Successful and failed historical runs are not changed. Obsolete pending runs are marked failed with instructions to queue a new run, rather than using current instructions under obsolete version metadata.

These changes constrain structure and improve extraction instructions. They do not deterministically prove that every permitted coded value is semantically supported. Real model results must still be compared with the transcripts.

## Reprocessing the Selected Interviews

After deploying the application and analysis worker from the same revision, queue a new run from each interview's existing admin review page. Process it with the normal analysis worker. If an obsolete pending run was already queued, let it be marked failed, then queue a new run. Preserve all prior runs.

| Interview ID | Evidence to check in the new result |
| --- | --- |
| 1efcd132-08d4-42bf-acf7-6d42a790dfba | No inferred `new` status or duration expectation; final thanks do not become an additional issue; quoted excerpts are copied exactly. |
| 2bb3ade0-4ce1-443b-933b-897b8cfdb426 | Six objective rows; one support category or explicit uncertainty, with all needs retained in narrative; unmet-need evidence cites participant sequence 14, not interviewer sequence 13. |
| 2bd723cc-5eb9-49ea-a0e9-2c48fe255289 | No invented service-delivery impact; networking from sequence 14 retained as additional material; garbled transcription acknowledged; no inferred place-name correction. |
| 877a9d91-e855-44c1-befd-c5ea9ede235f | No inferred early adoption or limited testing; preserve substantive answers; acknowledge audio complaint/repeated opening; retain extra finance workload from sequence 21. |
| 8f6ea9f5-c5cf-4200-84c5-693ec8cedce5 | Preserve transformation versus trimming; do not manufacture a new additional issue from the already-covered support need. |

For every succeeded run verify exactly six distinct objective rows, trace participant evidence, inspect confidence and limitations, and verify accepted quotes against canonical text. Zero to three accepted quotes is valid; do not weaken matching to meet a quota. Confirm new prompt/schema versions and that previous analyses remain visible.

The real-interview semantic rerun requires the configured deployment or local Supabase/OpenAI credentials. Automated tests alone do not establish that these five cases now pass the semantic review.

## Implementation Verification

On October 5, 2026, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` all passed on the final code revision. The full suite passed 238 tests across 39 files. `git diff --check` passed. No database migration is required; the persisted output structure is unchanged.

Changed implementation files: `lib/analysis/constants.ts`, `lib/analysis/schema.ts`, `lib/analysis/output-validation.ts`, `lib/analysis/repository.ts`, `lib/analysis/runner.ts`, `lib/openai/analysis.ts`, and `next.config.ts`.

Changed prompt sources: `prompts/post-interview-analysis.system.md` and the added `prompts/versions/wave5-post-interview-analysis-v4.md` archive. The base JSON schema and locked documents were preserved.

Regression coverage: `tests/analysis-validation.test.ts`, `tests/analysis-runner.test.ts`, `tests/analysis-quote-verification.test.ts`, and the added `tests/analysis-request.test.ts`. This note was added as the deployment/rerun checklist. Existing unrelated changes in `types/database.types.ts` and `UIDesign/` were left untouched.

Not performed: deployment, production database writes, paid model calls, or semantic reprocessing of the five real interviews. This checkout has no local runtime credential file configured. Those checks remain necessary after deployment.
