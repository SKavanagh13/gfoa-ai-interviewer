# The Listening Post — Implementation Guide

## Participant-facing vs. admin-facing

This design package covers **participant-facing screens only**:
landing, intake, consent, mic check, live interview (5 states), errors
(3 states), and endings (3 states).

**No admin screens were designed in this engagement** — there is no
admin-interview-list, admin-interview-detail, or admin-analysis-review
visual here, and none should be inferred from these files. The only
admin-related decision made is on the landing screen: admin access is
intentionally *not* shown as a peer action or link to participants at all
(previously a peer button in the old build); it's assumed to live at a
separate, unlinked route (e.g. `/admin`) outside this design's scope. If
admin screens are needed, that's a separate design task — flag it back
rather than building admin UI from these participant patterns.

## MVP-critical screens

All of the following are necessary for a complete participant flow and
should be treated as MVP-critical:
- Landing
- Intake (default, valid, error, loading)
- Consent
- Mic check
- Live interview (connecting, interviewer speaking, listening, processing,
  approaching time)
- The three endings (completed, ended early, technical failure)

The three error states (mic denied, connection failed, connection dropped)
are also necessary — they're the only designed recovery path when
something goes wrong before or during the call, including the
auto-reconnect-then-fall-back-to-technical-failure behavior described
below. Treat them as MVP-critical, not nice-to-have polish.

## Responsive behavior

- Primary target is desktop/laptop. Tablet must not break, per the design
  brief, but tablet is not the primary design target — mobile is out of
  scope for this pass.
- Cards use a fixed authored width with `max-width: 100%`, so the natural
  responsive behavior is: card stays at its authored width on anything
  wider than that width, and shrinks to fill available width with side
  margins on anything narrower (down to tablet).
- The landing screen's two-column layout (copy + decorative visual panel)
  is the one layout most likely to need a breakpoint decision on tablet —
  confirm the card still fits two columns at the target tablet width; if
  not, stack the visual panel below the copy rather than compressing it.
- No screen in this set relies on viewport height; do not introduce
  `100vh` locks when implementing — let cards size to content.

## Accessibility considerations

- All interactive elements (inputs, checkbox, buttons, links) should have
  visible focus states — none are shown explicitly in the static PNGs, but
  keyboard focus rings should use the brand blue and meet contrast
  requirements, consistent with the rest of the palette.
- The consent checkbox is the one legally/ethically load-bearing control in
  this entire flow — make sure it's a real `<input type="checkbox">` (or
  equivalent) with a properly associated `<label>`, not a styled div, so
  screen readers announce state changes correctly.
- Disabled buttons (intake Continue, consent Continue) should be true
  `disabled` elements, not just visually dimmed, so assistive tech and
  keyboard nav skip them appropriately until enabled.
- Live-region announcements are worth adding (not shown visually) for
  status changes during the call — e.g. announce "Connecting," "Listening,"
  "We lost the connection" — since the visual pulse/ring animation alone
  isn't perceivable to screen-reader or low-vision users context-switching
  in and out of the tab.
- Color is never the sole signal for error/success in these designs — error
  states pair color with an icon and text message, and valid inputs pair
  color with a checkmark glyph — preserve that redundancy in implementation.
- Text sizes in this design are already at or above typical minimums (15px+
  body, 22px+ headings) — don't shrink them when fitting to a component
  library's default scale.

## Assumptions made by this design

- There is exactly one intake step (email + confirm email) with no
  membership lookup or profile-confirmation step, per the brief — if the
  real app has additional intake steps, this package does not cover them.
- The interview is voice-only with no visible transcript or text chat
  during the live call — the live-interview visual is deliberately just a
  status indicator, not a transcript view.
- Elapsed time is participant-visible but explicitly not a countdown — the
  underlying app is assumed to still track a real duration/cap internally;
  this design just chooses not to surface it numerically as a countdown.
- Reconnection is assumed to be automatic and bounded (the app attempts to
  reconnect on drop, and if it can't, the app itself transitions to the
  technical-failure ending) — this design does not show a manual "retry"
  button on the drop screen because the intended behavior is automatic;
  "connection failed" (before the call ever started) is the one state that
  does offer a manual Reconnect action, since no session was in progress
  yet to auto-resume.
- Six-questions orientation copy is intentionally not shown on the live
  screen (per direction, kept off the live UI, and not otherwise persisted
  as an on-screen checklist) — confirm this is acceptable versus the old
  build's behavior before removing that copy from the app's code paths
  entirely; the content itself (interviewer curiosity / pause behavior) has
  been preserved on the consent screen instead.
