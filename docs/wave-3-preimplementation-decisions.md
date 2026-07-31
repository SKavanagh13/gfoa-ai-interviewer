# Wave 3 Pre-Implementation Decisions

## Sideband Runtime

Wave 3 uses a dedicated long-lived Node.js sideband worker process. Next.js API
routes remain short-lived signaling and control endpoints and only dispatch work
to `SIDEBAND_WORKER_BASE_URL`.

Local development runs the worker with `npm run sideband:dev`. Production must
run the same worker shape in a runtime that can hold WebSocket connections for
the 20-minute hard cap plus transcript reconciliation buffer, such as a
container, VM, or always-on Node service.

## OpenAI Sideband Contract

Official OpenAI Realtime docs confirmed on 2026-07-31:

- `POST https://api.openai.com/v1/realtime/calls` creates a WebRTC Realtime call.
- The response body is the SDP answer.
- The `Location` response header contains the call ID.
- A server-side sideband WebSocket can attach to the same WebRTC session at
  `wss://api.openai.com/v1/realtime?call_id={callId}`.
- The sideband WebSocket uses standard server-side Realtime WebSocket auth:
  `Authorization: Bearer $OPENAI_API_KEY`.
- The sideband WebSocket sends the normal Realtime server event stream, including
  finalized input transcription events and response completion events with
  assistant transcripts and usage.

Sources:

- https://developers.openai.com/api/docs/guides/realtime-server-controls
- https://developers.openai.com/api/docs/guides/realtime-websocket
- https://platform.openai.com/docs/api-reference/realtime
- https://platform.openai.com/docs/api-reference/realtime-server-events/conversation/item/input_audio_transcription/completed

## Participant Session Auth

Wave 3 participant-facing routes require an HttpOnly participant-session cookie.
The raw token is never stored and is not returned to client JavaScript. The
database stores only an HMAC digest keyed by the interview ID plus an expiration
timestamp.

## Mutual Activation

Both the browser-connected path and the sideband-connected path call the same
`try_mark_interview_active` RPC through the session repository. The RPC is
idempotent and marks `active` only when both connection statuses are `connected`.
