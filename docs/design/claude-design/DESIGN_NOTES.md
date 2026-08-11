# The Listening Post — Design Notes

Scope note: this package covers **participant-facing screens only**. No admin
screens (interview list, interview detail, analysis review) were designed in
this engagement — see IMPLEMENTATION_GUIDE.md. Do not infer admin UI from
these files.

File naming note: the app has no separate "email confirmation" step. Intake
is a single screen (email + confirm-email fields) with several states.
`email-confirmation.png` shows that screen once both fields validate
(confirmation checkmarks appear inline) — it is a state of intake, not a
separate screen.

## Screen-by-screen

### landing.png
First screen on opening the app. Left column: GFOA wordmark, "The Listening
Post" title, one-line description, primary CTA ("Begin the interview"), and a
small line on time commitment and when recording starts. Right column: a
decorative panel with the signal-tower motif (see below). No admin/staff link
is present — admin is intentionally not surfaced to participants.

### participant-intake.png (+ --error, --loading states; email-confirmation.png = valid state)
Email + confirm-email fields. States: default (empty, Continue disabled),
valid (both fields match, checkmarks shown, Continue enabled), error (fields
don't match, inline red message, Continue disabled), loading (fields
disabled, button shows spinner "Sending confirmation…").

### consent.png
Single screen holding all required consent content: AI interviewer
disclosure, recording/transcription disclosure, ~15 minute duration with
note that it may run longer only with agreement, GFOA staff review
disclosure, and "nothing recorded until consent" — all inside one visually
grouped panel. Below that, a "While you talk" note covering interviewer
follow-up behavior and the pause-after-you-finish behavior, so participants
aren't alarmed by either mid-interview. A single checkbox is the explicit
affirmative consent action; Continue is disabled until it's checked.

### mic-check.png
Requests mic permission and confirms it's working. Shows a live level meter
(animated bars) and a short "say a few words" prompt, then a confirmation
line and Continue button once sound is detected. Includes a "Test again"
link.

### interview-active.png (+ --connecting, --listening, --processing, --approaching-time)
The live interview, one shared layout with distinct center-of-screen states:
connecting (dim tower + soft pulse), interviewer speaking (tower + slow
outward rings), listening (tower + faster outward rings), processing (three
dots, brief), approaching time (interviewer-speaking visual + a quiet pill
reading "We're coming up on time — just a couple more questions"). A quiet
elapsed-time label sits top-right; "End interview" is always available,
understated, at the bottom. No numeric countdown, no six-questions checklist
on this screen (that context lives on the consent/pre-interview screens
instead, per direction).

### error--microphone-denied.png, error--connection-failed.png, error--connection-dropped.png
Non-alarming error treatments, each with a clear next step: mic denied asks
the user to enable access and try again; connection failed offers Reconnect
or End for now; connection dropped shows a quiet reconnecting spinner with
reassurance that nothing is lost, and falls through to the technical-failure
ending if reconnection doesn't succeed.

### interview-complete.png, --ended-early, --technical-failure
Three distinct endings, none of which show timers or start/end controls:
completed (warm thank-you + what happens next + "you may close this
window"), ended early (thanks for starting + how to resume another time),
technical failure (what happened + reassurance that captured content was
saved). All three share layout and only differ in icon, headline, and body
copy.

## Intended flow

Landing → Intake (email + confirm) → Consent → Mic check → Live interview
(connecting → interviewer speaking / listening / processing, repeating,
with an approaching-time cue near the end) → one of the three endings.
Error states can interrupt mic check or the live interview at any point;
connection-dropped attempts to reconnect before falling back to the
technical-failure ending.

## Layout behavior

- Desktop/laptop is primary. Cards are centered, fixed-width (600–760px),
  comfortable padding, generous line length for body copy.
- Tablet: the design does not use viewport units or fixed pixel positioning
  outside the card, so cards can be centered with normal responsive margins;
  at tablet widths the card should stay at or near its authored width rather
  than stretching edge-to-edge. Landing's two-column layout (copy + visual
  panel) should stack only below tablet width if needed — at tablet width it
  should still fit two columns given the 760px card width used here.
- No layout in this set assumes a viewport taller/shorter than a card's
  content; cards are not viewport-locked.

## Interactions implied

- Continue/primary buttons are disabled until their screen's required input
  is valid (intake) or explicitly consented (consent checkbox).
- "End interview" is always tappable during the live states.
- "Test again" on mic check re-runs the level-meter check.
- Reconnect / End for now are two distinct actions on connection-failed.
- Error → reconnect attempts should fall back automatically to the
  technical-failure ending if reconnection doesn't succeed (no user action
  required to reach that ending).

## Intentional departures from "standard app" behavior

- No progress bar or numeric countdown during the interview — elapsed time
  is shown quietly, and the "approaching time" cue is a soft text pill, not
  a warning/alert style. This is deliberate: nothing on this screen should
  compete with the interviewer's own spoken pacing.
- No six-questions checklist or step tracker during the live interview —
  that orientation content is given up front (mic-check/consent) instead of
  persisting on-screen.
- Admin access is not a peer action on the landing page at all (not even a
  demoted link), per direction — it's assumed to live at a separate,
  unlinked route.
- End states show no leftover timers, transcripts, or start/end buttons —
  once ended, the only actions available are closing the window or normal
  page furniture.
