# MVP Deployment Readiness

This runbook captures the minimum deployment setup needed before a real MVP
pilot. It does not add product scope and does not replace the locked
requirements in `docs/locked/`.

## Required Environment Variables

Configure these values in the application runtime and in any separate sideband
worker runtime before running a pilot.

| Variable | Scope | Required In | MVP readiness note |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public client | Next.js app | Supabase project URL for the target environment. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public client | Next.js app | Supabase anon key for browser-authenticated flows. |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret server | Next.js app, sideband worker | Server-side only. Never expose to browser code or logs. |
| `OPENAI_API_KEY` | Secret server | Next.js app, sideband worker | Use the OpenAI project configured for the MVP pilot. |
| `OPENAI_REALTIME_MODEL` | Server config | Next.js app, sideband worker | Realtime voice model used by the live interviewer. |
| `OPENAI_ANALYSIS_MODEL` | Server config | Next.js app | Separate model used for post-interview analysis. |
| `REALTIME_SESSION_TARGET_SECONDS` | Server config | Next.js app, sideband worker | Set to `900` for the 15-minute target. |
| `REALTIME_SESSION_HARD_CAP_SECONDS` | Server config | Next.js app, sideband worker | Set to `1200`; validation rejects values above 20 minutes. |
| `SIDEBAND_CONNECTION_TIMEOUT_MS` | Server config | Next.js app, sideband worker | Startup/connectivity timeout for sideband readiness. |
| `SIDEBAND_DISPATCH_SECRET` | Secret server | Next.js app, sideband worker | Shared secret for internal dispatch to the sideband worker. |
| `PARTICIPANT_SESSION_TOKEN_SECRET` | Secret server | Next.js app, sideband worker | HMAC secret for participant-session cookies. |
| `PARTICIPANT_SESSION_TOKEN_TTL_SECONDS` | Server config | Next.js app, sideband worker | Must be greater than `REALTIME_SESSION_HARD_CAP_SECONDS`. |
| `SIDEBAND_WORKER_BASE_URL` | Server config | Next.js app | Internal base URL where the Next.js app can reach the worker. |
| `TRANSCRIPT_RECONCILIATION_TIMEOUT_MS` | Server config | Next.js app, sideband worker | Buffer for transcript reconciliation after call close. |
| `SIDEBAND_WORKER_PORT` | Server config | Sideband worker | Optional; defaults to `8787` for local/dev worker runs. |

Do not commit real secrets to the repository. For local examples, use dummy
values only.

## Sideband Worker Deployment

The live interviewer depends on a dedicated long-lived Node.js sideband worker.
The Next.js app dispatches to the worker with:

```text
POST {SIDEBAND_WORKER_BASE_URL}/sideband/start
X-Sideband-Dispatch-Secret: {SIDEBAND_DISPATCH_SECRET}
```

For local development, run:

```powershell
npm run sideband:dev
```

For a pilot deployment, run the same worker shape in a runtime that can keep an
OpenAI Realtime sideband WebSocket open for the 20-minute hard cap plus the
transcript reconciliation buffer. Suitable runtimes include an always-on Node
service, VM, or container service. Short-lived serverless functions are not
acceptable for the sideband worker.

Before E2E testing, verify:

1. The Next.js app can reach `SIDEBAND_WORKER_BASE_URL` from its server runtime.
2. The worker rejects requests missing `X-Sideband-Dispatch-Secret`.
3. The worker accepts a valid internal dispatch and returns `202`.
4. Worker logs do not print OpenAI keys, Supabase service-role keys, participant
   session secrets, or dispatch secrets.
5. The worker runtime has outbound WebSocket access to OpenAI Realtime.

## Supabase Setup

Apply all migrations to the target Supabase project before a pilot. The private
storage migration creates `interview-audio` and `interview-transcripts` as
private buckets and intentionally does not add direct object access policies.

Create pilot reviewer accounts with Supabase Auth. Staff/admin authorization is
based on `user.app_metadata.role`:

| Role | Access |
| --- | --- |
| `staff` | Authenticated admin review access without direct participant identifiers. |
| `admin` | Authenticated admin review access with direct participant identifiers. |

Before E2E testing, verify:

1. A user without `staff` or `admin` app metadata cannot access `/admin`.
2. A `staff` user can access admin review pages but cannot view direct
   participant identifiers.
3. An `admin` user can access approved direct participant identity linkage.
4. Private storage buckets remain `public = false`.
5. No `storage.objects` policy exposes direct object reads for MVP.

## OpenAI Budget Readiness

Before any real participant pilot, configure an OpenAI project budget or
spending alert for the API project used by the deployment. Record the alert
threshold, recipients, pilot owner, and technical owner in the deployment notes
for the target environment.

During E2E testing, compare application-level estimated live, analysis, and
total costs with the provider billing view. Do not add an in-app dashboard or
aggregate spend report for MVP readiness.

## Preflight Commands

Run these commands before a deployment candidate is considered ready:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

If migrations, RPCs, RLS, storage SQL, or generated database types changed, run:

```powershell
npm run db:reset
npm run db:types
npm run typecheck
npm test
```

## E2E Readiness Checks

Before a real pilot, complete one manual E2E rehearsal against the target
environment:

1. Submit intake and consent.
2. Start a voice interview.
3. Confirm browser and sideband connection statuses become active.
4. Confirm the 15-minute continuation prompt path and 20-minute hard cap remain
   enforced.
5. End with a completed interview and verify the completed disposition.
6. Confirm transcript segments are persisted server-side.
7. Run post-interview analysis and verify exactly six objective-result rows.
8. Confirm admin/staff access boundaries.
9. Confirm private storage remains path-only in admin UI.
10. Confirm cost fields and cost category are populated consistently.
