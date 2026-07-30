# GFOA AI Voice Interviewer

This repository contains the approved requirements and implementation workspace for the GFOA AI Voice Interviewer MVP.

Locked requirements live in `docs/locked/`. Treat those documents as binding requirements.

## Authority and precedence

Treat these documents as binding requirements. Do not silently reinterpret, rewrite, or optimize them.

If two documents appear to conflict, use this precedence order:

1. `05-ai-voice-interviewer-mvp-technical-specification.md`
2. `04-ai-voice-interviewer-mvp-flow.md`
3. `03-per-interview-output-specification.md`
4. `02-ai-interviewer-guide.md`
5. `01-ai-interviewer-operating-principles.md`

The higher-ranked document controls only where there is a direct implementation conflict. Otherwise, all documents apply together.

## Document roles

- **Operating Principles:** how the live interviewer behaves.
- **Interview Guide:** the six objectives, preferred questions, completion criteria, and suggested follow-ups.
- **Per-Interview Output Specification:** what the post-interview analysis produces and the evidentiary guardrails it must follow.
- **MVP Flow:** the approved end-to-end product flow and lifecycle.
- **MVP Technical Specification:** buildable architecture, schema requirements, implementation waves, and acceptance tests.

## Change control

The files in `docs/locked/` are locked. Coding agents may point out a material conflict or implementation blocker, but they must not edit files in that folder unless the user explicitly authorizes a requirements change.

Any approved revision should:

1. be made intentionally;
2. update the relevant document version;
3. be committed separately from implementation code when practical; and
4. note which requirement changed and why.

## Database type generation

Wave 1 stores Supabase database schema changes in `supabase/migrations/`. The Supabase CLI is installed as a project dev dependency.

After Docker is available and local Supabase services are running, regenerate database types with:

```bash
npm run db:start
npm run db:reset
npm run db:types
```

`types/database.types.ts` is a placeholder until local Supabase services can run and the type-generation command succeeds.
