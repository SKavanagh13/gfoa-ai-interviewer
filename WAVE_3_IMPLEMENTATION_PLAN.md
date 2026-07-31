# Wave 3 Implementation Plan — Live Voice Session

## Current Wave

Wave 3 — Live Voice Session

This plan is bounded to the Wave 3 scope in `docs/locked/05-ai-voice-interviewer-mvp-technical-specification.md`.

## Binding Inputs Reviewed

- `AGENTS.md`
- `docs/locked/01-ai-interviewer-operating-principles.md`
- `docs/locked/02-ai-interviewer-guide.md`
- `docs/locked/03-per-interview-output-specification.md`
- `docs/locked/04-ai-voice-interviewer-mvp-flow.md`
- `docs/locked/05-ai-voice-interviewer-mvp-technical-specification.md`

Current OpenAI Realtime documentation was also checked for Wave 3 planning assumptions:

- `POST /v1/realtime/calls` creates a WebRTC Realtime call and returns an SDP answer.
- The `Location` response header includes the call ID for follow-up requests such as monitoring or hangup.
- `POST /v1/realtime/calls/{call_id}/hangup` ends a WebRTC or SIP Realtime call.
- The API reference states that the call ID can be used for establishing a monitoring WebSocket, but this plan must not proceed to implementation until the exact sideband WebSocket URL pattern, auth requirements, and event contract are confirmed from official OpenAI documentation or support.

## Wave 3 Scope

Implement only the live voice session infrastructure:

- server-side Realtime session/call creation;
- capture and persistence of the Realtime call ID;
- browser WebRTC connection;
- server-side sideband WebSocket connection to the same Realtime session;
- incremental, idempotent persistence of finalized transcript and usage events;
- microphone permission handling;
- elapsed-time, near-limit, and hard-cap timing signals;
- authoritative server-side 20-minute termination;
- browser-side teardown safeguard;
- disposition recording;
- transcript stabilization and reconciliation.

## Explicitly Out Of Scope

Wave 3 must not implement:

- post-interview eligibility classification;
- post-interview analysis;
- JSON schema validation of analysis output;
- deterministic quote verification;
- admin review UI;
- cross-interview dashboards or analytics;
- formal theme taxonomy;
- recommendation generation.

Wave 4 owns standalone canonical transcript utilities such as deterministic serialization and quote-normalization helpers. Wave 3 may persist finalized transcript segments and mark transcript state only to the extent required for live capture and lifecycle.

## Material Conflicts Or Ambiguities

No material conflicts were identified among the locked documents.

Material blockers to resolve before implementation:

- **Sideband deployment runtime:** A server-side sideband controller must keep an open WebSocket for up to 20 minutes. Standard serverless or edge-style Next.js API routes must not be assumed capable of hosting this connection. The implementation must choose and document a long-lived runtime before sideband code is written.
- **OpenAI sideband endpoint:** The locked spec requires a server-side sideband WebSocket to the same Realtime session. Current OpenAI docs confirm the Realtime call ID is returned via the `Location` header and is used for follow-up requests such as establishing a monitoring WebSocket or hangup. The exact sideband WebSocket endpoint, auth requirements, and event stream behavior must be confirmed before implementation. If OpenAI does not expose a server-attachable event stream for WebRTC calls that emits finalized transcript events, this is an architecture conflict with the locked spec and implementation must stop.
- **Participant-route authorization:** Wave 3 participant-facing routes cannot rely on `interviewId` alone. They need a short-lived participant session token or equivalent authorization mechanism before Realtime call creation, browser-connected, or end routes are implemented.
- **Activation synchronization:** Browser and sideband connection events can arrive in either order. The implementation must define a mutual-completion path so whichever side connects second can mark the interview active if both statuses are now connected.
- **Wave 3 versus Wave 4 transcript boundary:** Wave 3 must persist finalized transcript events incrementally and stabilize/reconcile transcript state. Wave 4 should still own deterministic transcript serialization and quote matching utilities.
- **Consent/governance readiness:** The Wave 2 consent language is MVP-level. This does not block Wave 3 development, but final consent/privacy/retention language remains a pre-launch governance dependency.

## Required Decisions Before Coding

Wave 3 implementation must not start until these decisions are documented in the implementation task:

1. **Sideband runtime decision**

   Use a dedicated long-lived Node.js worker process for the sideband controller. Next.js API routes should remain signaling/control endpoints only; they should not host the 20-minute sideband WebSocket.

   Acceptable deployment shapes include a container, VM, or long-lived Node service that can hold WebSocket connections for at least the 20-minute hard cap plus reconciliation buffer. Examples include Render, Fly.io, Railway, AWS ECS/App Runner, Azure Container Apps, or another equivalent always-on Node runtime.

   Local development should run the worker as a separate process, for example `npm run sideband:dev`.

   If no acceptable long-lived runtime is available for production, Wave 3 implementation is blocked and the architecture must be revisited before coding.

2. **OpenAI sideband endpoint verification**

   Before implementing `sideband-controller.ts`, verify and document from official OpenAI documentation or support:

   - the exact WebSocket URL pattern for attaching to an existing WebRTC Realtime call by call ID;
   - required headers and auth scheme;
   - whether the sideband stream receives finalized participant and model transcript events;
   - whether the sideband stream receives usage events needed for cost tracking;
   - what close/error/session-ended events are emitted when the browser WebRTC peer disconnects;
   - the supported keepalive/ping behavior for idle periods.

   If the sideband stream cannot provide durable finalized transcript events for browser WebRTC calls, this conflicts with the locked topology in section 4.5 of the MVP Technical Specification. Stop and surface that conflict before implementation.

3. **Participant session authorization**

   Add a short-lived participant session token before exposing live-session API routes. The recommended approach is:

   - generate a cryptographically random participant session token when the consented interview is created;
   - store only a hash or HMAC digest server-side, associated with the interview ID and expiration timestamp;
   - set the raw token in an `HttpOnly`, `SameSite=Lax` or stricter cookie scoped to the interview route;
   - require the cookie token on all participant-facing Wave 3 routes;
   - reject requests when the token is missing, expired, or does not match the interview ID;
   - never put the token in the URL;
   - never return the token to client JavaScript unless an explicit non-cookie fallback is approved.

   Suggested TTL: long enough for setup plus the 20-minute interview and reconciliation buffer, such as 45 minutes.

4. **Activation synchronization**

   Implement a single repository method or RPC such as `tryMarkInterviewActive(interviewId)` that:

   - reads or atomically checks `browser_connection_status`;
   - reads or atomically checks `sideband_connection_status`;
   - marks lifecycle `active` only when both are `connected`;
   - is safe to call repeatedly;
   - is called by both the browser-connected path and the sideband-connected path.

   This mutual-completion pattern prevents a limbo state when the browser connects before the sideband or the sideband connects before the browser.

5. **Transcript acceptance boundary**

   Wave 3 cannot fully satisfy every transcript acceptance test listed in section 16 of the MVP Technical Specification because section 17 assigns deterministic serialization to Wave 4. Wave 3 completion should be reviewed against live capture and stabilization requirements only. Wave 4 must explicitly close the remaining transcript acceptance criteria:

   - deterministic `serializeTranscript(segments): string`;
   - duplicate or missing sequence-number validation as a standalone canonical transcript utility;
   - quote/evidence utilities that operate on the same serialized segment text.

## Proposed Implementation

### 1. Branch

Create a fresh branch from `main`:

```bash
git checkout main
git pull --ff-only origin main
git checkout -b codex/wave-3-live-voice-session
```

### 2. Environment Configuration

Add server-only environment variables:

- `OPENAI_API_KEY`
- `OPENAI_REALTIME_MODEL`
- `REALTIME_SESSION_TARGET_SECONDS`
- `REALTIME_SESSION_HARD_CAP_SECONDS`
- `SIDEBAND_CONNECTION_TIMEOUT_MS`
- `PARTICIPANT_SESSION_TOKEN_SECRET`
- `PARTICIPANT_SESSION_TOKEN_TTL_SECONDS`
- `SIDEBAND_WORKER_BASE_URL` or equivalent worker dispatch configuration, if the sideband worker is a separate deployed service

Recommended defaults for local examples:

- `OPENAI_REALTIME_MODEL=gpt-realtime`
- `REALTIME_SESSION_TARGET_SECONDS=900`
- `REALTIME_SESSION_HARD_CAP_SECONDS=1200`
- `SIDEBAND_CONNECTION_TIMEOUT_MS=10000`
- `PARTICIPANT_SESSION_TOKEN_TTL_SECONDS=2700`

Update:

- `.env.example`
- `lib/server-env-core.ts`
- `lib/env.ts`
- `tests/env.test.ts`

Validation rules:

- `OPENAI_API_KEY` is required server-side only.
- target seconds and hard-cap seconds must be positive integers.
- hard cap must be greater than target.
- hard cap must not exceed 1200 seconds.
- sideband connection timeout must be a positive integer.
- participant session token secret is required server-side only.
- participant session token TTL must be greater than the hard cap.

### 3. OpenAI Realtime Client

Add `lib/openai/realtime.ts`.

Responsibilities:

- build Realtime session configuration from locked prompt files;
- include confirmed participant context only when useful and non-surveillant;
- set model from server env;
- configure audio input/output for speech-to-speech;
- configure input transcription so finalized transcript events are emitted;
- explicitly avoid tools and web access;
- create a WebRTC call by sending the browser SDP offer to `POST /v1/realtime/calls`;
- parse the SDP answer response body;
- parse the Realtime call ID from the `Location` header;
- hang up a call with `POST /v1/realtime/calls/{call_id}/hangup`.

The implementation should use direct `fetch` rather than a browser-facing SDK so the server can read the `Location` header and keep the permanent OpenAI API key server-side.

### 4. Live Prompt Builder

Add `lib/interview/live-prompt.ts`.

Responsibilities:

- compose the live interviewer instructions from:
  - locked Operating Principles;
  - locked Interview Guide;
  - timing rules;
  - no-advice/no-GFOA-position rules;
  - no administrative intake questions;
  - confirmed participant context when useful;
  - 15-minute target;
  - 20-minute hard ceiling;
- keep the live prompt separate from post-interview analysis prompts.

The live prompt must govern conversation only. It must not perform post-interview analysis or structured extraction.

### 5. Session Repository

Add `lib/interview/session-repository.ts`.

Responsibilities:

- load interview and participant/profile context by interview ID;
- confirm the interview has consent metadata before session start;
- persist `realtime_call_id`;
- update `browser_connection_status`;
- update `sideband_connection_status`;
- mark lifecycle status;
- insert finalized transcript segments idempotently using provider event IDs where available;
- record usage fields when Realtime usage events are available;
- record technical errors;
- mark end disposition:
  - `completed`;
  - `participant_ended`;
  - `technical_failure`;
- mark transcript status:
  - `pending`;
  - `stabilizing`;
  - `stable`;
  - `failed`;
- record `transcript_reconciliation_timeout_ms`.
- validate participant session tokens for participant-facing routes;
- expose an idempotent `tryMarkInterviewActive(interviewId)` method called by both browser-connected and sideband-connected flows.

The repository must not duplicate direct identifiers into analytical records.

### 6. API Routes

Precondition:

- Participant session authorization must be implemented before these routes are exposed.
- API routes must remain short-lived signaling/control endpoints. They must not host the long-lived sideband WebSocket.

Add `POST /api/interview/[interviewId]/realtime-call`.

Responsibilities:

- accept a browser SDP offer;
- require a valid participant session token for the interview;
- validate that the interview exists and consent has been recorded;
- create the OpenAI Realtime WebRTC call server-side;
- persist `realtime_call_id`;
- dispatch the long-lived sideband worker for this call;
- return the SDP answer to the browser;
- never return the permanent OpenAI API key;
- never mark the interview `active` unless both browser and sideband connection statuses are `connected`.

Add `POST /api/interview/[interviewId]/browser-connected`.

Responsibilities:

- require a valid participant session token for the interview;
- mark browser connection status `connected` after the peer connection reaches a valid connected state;
- call `tryMarkInterviewActive(interviewId)` so activation completes if the sideband is already connected.

Add `POST /api/interview/[interviewId]/end`.

Responsibilities:

- require a valid participant session token for the interview;
- handle participant-ended flow;
- call Realtime hangup if a call ID exists;
- mark lifecycle `ending` and then `ended`;
- record `participant_ended` unless a completed or technical-failure disposition has already been recorded.

### 7. Sideband Controller

Add `lib/interview/sideband-controller.ts`.

Preconditions:

- Do not implement this controller inside an ordinary Next.js API route.
- Confirm the official OpenAI sideband WebSocket endpoint, auth, and finalized transcript event contract before coding.
- If the sideband endpoint cannot attach to browser WebRTC calls and emit finalized transcript events, stop and raise an architecture conflict.

Responsibilities:

- connect server-side to the same Realtime call using the call ID;
- monitor Realtime server events;
- persist finalized user/interviewer transcript events;
- persist usage events when provided;
- send session/timing updates when needed;
- enforce the 15-minute near-limit signal;
- enforce the authoritative 20-minute hard cap;
- call Realtime hangup at hard cap;
- record `technical_failure` if the sideband connection cannot be established within the bounded timeout;
- never allow browser-only connection to become a normal active session.
- when sideband reaches `connected`, call `tryMarkInterviewActive(interviewId)` so activation completes if the browser is already connected.
- use an explicit keepalive strategy compatible with the confirmed OpenAI sideband WebSocket behavior.

Important invariant:

The server-side sideband path is authoritative for transcript/event capture and hard-cap enforcement. Browser timers and browser teardown are participant-facing safeguards only.

### 8. Transcript Capture And Stabilization

Wave 3 should implement the minimum runtime transcript handling needed for live capture:

- write finalized transcript segments as events arrive;
- preserve ordering;
- preserve speaker labels;
- preserve provider event IDs when available;
- deduplicate repeated provider events;
- mark transcript `stabilizing` when the session ends;
- wait for the sideband end signal or a bounded reconciliation timeout;
- mark transcript `stable` only after finalized events received before cutoff are persisted and sequence/finalization checks pass;
- mark transcript `failed` with `transcript_processing_error` if stabilization cannot be established.

Wave 3 should not implement quote matching or the standalone `serializeTranscript(segments): string` utility unless required as a small internal helper for stabilization tests. The full canonical transcript utility belongs in Wave 4.

### 9. Browser UI

Replace the Wave 2 created-interview handoff with a live-session start surface.

Responsibilities:

- show interview ID and readiness state;
- request microphone permission;
- handle microphone denial with a clear failure state;
- create an `RTCPeerConnection`;
- add the local microphone audio track;
- receive and play model audio;
- create an SDP offer;
- send the SDP offer to the server route;
- apply the SDP answer;
- notify the server when the browser peer connection is connected;
- include only the HttpOnly participant session cookie automatically; do not send participant session tokens in JavaScript-visible payloads;
- show connection status;
- show elapsed time;
- show near-limit state;
- provide an end-interview control;
- tear down the browser peer connection at the 20-minute hard cap as a secondary safeguard.

The browser must not receive the permanent OpenAI API key.

### 10. Lifecycle Rules

Lifecycle transitions:

- Wave 2 creates interview in `created`.
- Browser connection begins: `browser_connection_status` moves toward `connected`.
- Sideband connection begins: `sideband_connection_status` moves toward `connected`.
- Interview may become `active` only through `tryMarkInterviewActive(interviewId)` after both browser and sideband are `connected`.
- Both browser-connected and sideband-connected flows must call `tryMarkInterviewActive(interviewId)`.
- Ending starts: lifecycle becomes `ending`.
- Session finalizes: lifecycle becomes `ended` or `failed`.

Disposition rules:

- `completed` when the interviewer ran its closing.
- `participant_ended` when the participant ended before closing.
- `technical_failure` when a required component failed.

The system must not infer why a participant left from connection behavior alone.

### 11. Timing Rules

- Target duration: 900 seconds.
- Near-limit signal: provide a signal early enough for pacing and the approved check-in.
- Hard cap: 1200 seconds.
- Server-side sideband controller is authoritative for the hard cap.
- Browser timer is only a secondary safeguard.
- At hard cap:
  - send forced closing when technically possible;
  - call Realtime hangup;
  - tear down browser connection;
  - finalize lifecycle and transcript stabilization.

### 12. Tests

Add or update tests for:

- env validation for OpenAI and timing variables;
- hard cap cannot exceed 1200 seconds;
- hard cap must be greater than target;
- participant session token TTL must exceed the hard cap;
- participant-facing API routes reject missing, expired, or mismatched participant session tokens;
- participant session tokens are stored hashed/HMACed server-side, not in plaintext;
- Realtime session payload includes locked prompt content/references;
- Realtime session payload does not include tools or web access;
- Realtime call creation parses SDP answer and call ID from `Location`;
- permanent OpenAI API key is never returned from API routes;
- interview cannot become active without both browser and sideband connected;
- activation completes when browser connects first and sideband connects second;
- activation completes when sideband connects first and browser connects second;
- repeated activation attempts are idempotent;
- sideband connection failure records `technical_failure`;
- participant-ended API route records `participant_ended`;
- hard-cap path calls Realtime hangup;
- duplicate provider events do not create duplicate transcript segments;
- transcript stabilization records timeout and stable/failed state;
- microphone denial is represented in browser UI state;
- no direct identifiers are written into analytical tables.

### 13. Validation Before Completion

Run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run db:reset
```

Run `npm run db:types` if any migration or RPC shape changes generated database types.

If an OpenAI API key is available, perform a local manual smoke test:

- create intake/consent record;
- start a Realtime WebRTC session;
- verify call ID persisted;
- verify browser and sideband statuses;
- speak at least one short participant turn;
- verify finalized transcript segment persisted from sideband path;
- end the interview;
- verify disposition and transcript status.

## Suggested PR Review Focus

Ask review to focus on:

- sideband deployment runtime is long-lived and not an ordinary serverless/edge API route;
- the implemented sideband endpoint and event contract were verified from official OpenAI docs or support before coding;
- no permanent OpenAI API key exposure;
- participant-facing live-session routes cannot be manipulated with only an interview ID;
- sideband path is authoritative for transcript/event capture;
- sideband path is authoritative for 20-minute termination;
- browser-only transcript capture is not treated as canonical;
- interview cannot become active unless both browser and sideband connections are established, regardless of connection order;
- lifecycle/disposition states are observable and not inferred beyond the spec;
- no post-interview analysis or quote verification behavior is introduced early;
- direct identifiers remain out of analytical records.

## Expected Changed Areas

Likely files and folders:

- `.env.example`
- `lib/env.ts`
- `lib/server-env-core.ts`
- `lib/openai/`
- `lib/interview/`
- sideband worker entry point, such as `workers/sideband/` or `scripts/sideband-worker.ts`
- `app/api/interview/[interviewId]/`
- `app/interview/created/`
- `app/globals.css`
- `tests/`
- `types/database.types.ts` if migrations change
- `supabase/migrations/` for participant session token storage, activation RPCs, or lifecycle constraints

## Residual Risks

- Realtime sideband behavior is API-sensitive. Implementation is blocked until the sideband attach endpoint, auth requirements, event contract, and keepalive behavior are verified.
- Browser WebRTC behavior may require real-browser manual testing beyond unit tests.
- Local and production deployment environments may differ in how long-lived server-side sideband controllers can run. The plan now requires a separate long-lived Node worker/runtime decision before implementation.
- If production hosting cannot support a 20-minute sideband WebSocket plus reconciliation buffer, Wave 3 implementation must stop before code is written.
- Final privacy, retention, and data-governance language remains outside the code wave but must be resolved before real participant launch.
