# Agent Instructions — GFOA AI Voice Interviewer

## Binding requirements

Before planning or editing code, read every file in `docs/locked/`.

Treat those files as binding requirements. Do not silently reinterpret them. If code, a proposed implementation, or two requirements conflict, stop and identify the conflict before changing either.

## Current development method

Work in bounded implementation waves defined in the MVP Technical Specification.

For each task:

1. Inspect the repository and relevant locked documents.
2. State the current wave and exact scope.
3. Propose the smallest implementation that satisfies the current acceptance criteria.
4. Do not build future-wave features.
5. Add or update tests with every behavioral change.
6. Run lint, typecheck, tests, and production build before declaring completion.
7. Report changed files, commands run, results, and unresolved risks.

## Requirements discipline

- Do not edit `docs/locked/` without explicit user authorization.
- Do not replace explicit `not_discussed`, `unclear`, or `not_covered` states with inference.
- Do not duplicate direct participant identifiers into analytical records.
- Do not combine the live interviewer and post-interview analysis into one model process.
- Do not make browser-only transcript capture authoritative.
- Do not weaken the server-enforced 20-minute cap.
- Do not allow a successful analysis to persist fewer or more than six objective-result rows.
- Do not treat model-proposed quotes as verified until deterministic matching succeeds.
- Preserve prior analysis runs and versioned prompts; do not overwrite historical outputs.

## Scope control

Unless the user explicitly changes scope, the MVP excludes:

- cross-interview dashboards and aggregate analytics;
- a formal theme taxonomy;
- synthetic personas or decision agents;
- broad product polish beyond the basic participant and admin flows;
- optional architecture enhancements not required by the current wave.

## Review standard

When reviewing work, identify material requirement violations, security or privacy failures, data-integrity risks, or changes likely to cause substantial rework. Do not generate endless optional improvements.
