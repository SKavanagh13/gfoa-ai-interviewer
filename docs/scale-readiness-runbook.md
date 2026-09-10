# Scale Readiness Runbook

This runbook supports a larger MVP pilot without changing the locked product
scope. It is for operational control of a few hundred invited participants, not
cross-interview analytics or public reporting.

## Capacity Guard

Set `MAX_ACTIVE_INTERVIEWS` in the application runtime before inviting a large
participant pool.

- `0` or unset means no application-level admission cap.
- A positive integer caps new Realtime session starts when that many interviews
  are already active or ending.
- Start conservatively until the sideband worker and OpenAI project limits are
  verified under load.

Recommended first pilot setting: `MAX_ACTIVE_INTERVIEWS=20`.

When the cap is reached, the participant is asked to wait a few minutes and try
again. The application does not create an OpenAI Realtime call and does not mark
the interview as a technical failure.

## Invite Waves

Use invite waves rather than one large blast.

1. Send a small rehearsal wave to internal testers or trusted participants.
2. Confirm live connection, transcript stability, review access, and cost
   capture.
3. Send the first external wave to roughly two to three times the active-session
   cap.
4. Increase wave size only after the sideband worker, OpenAI project usage, and
   Supabase writes look stable.

For a few hundred total participants, prefer several waves separated by at
least one expected interview duration.

## Preflight

Before each large wave:

- Confirm the sideband worker is running in a long-lived Node runtime.
- Confirm the Next.js runtime can reach `SIDEBAND_WORKER_BASE_URL`.
- Confirm the OpenAI project budget or spending alert is active.
- Confirm the current OpenAI project has enough Realtime and analysis capacity.
- Confirm private Supabase Storage buckets remain private.
- Run one complete end-to-end interview in the target environment.

## Pause Criteria

Pause new invitations or temporarily lower `MAX_ACTIVE_INTERVIEWS` if any of
these occur:

- repeated `sideband_dispatch_failed` starts;
- multiple transcript stabilization failures;
- Realtime creation failures that indicate provider capacity or quota issues;
- sideband worker restarts during active interviews;
- live cost diverges materially from expected billing;
- reviewers cannot access completed records or trace analysis to transcript
  segments.

## Post-Wave Checks

After each wave:

- Count completed, participant-ended, technical-failure, and transcript-failed
  sessions.
- Spot-check canonical transcript segments for a few completed sessions.
- Run or rerun post-interview analysis only after transcript status is stable.
- Confirm each succeeded analysis has exactly six objective-result rows.
- Compare application-level estimated costs with provider billing.

## Next Hardening Pass

After the capacity guard has been exercised with real traffic, the next bounded
implementation pass should add:

- admin list pagination and filters;
- a controlled post-interview analysis queue;
- worker-level health and concurrency telemetry;
- a rehearsal script for 20 to 30 simultaneous sessions.
