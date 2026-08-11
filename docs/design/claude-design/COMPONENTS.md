# The Listening Post — Component Inventory

## App shell / card frame
- **Where**: every screen.
- **Visual**: centered white card, 600px (or 760px for landing), 16px
  radius, standard shadow, on a `#faf9f6` page background.
- **Interaction**: none itself; contains the screen's content.
- **Variants**: single-column (intake, consent, mic check, live, errors,
  endings) vs. two-column (landing only: copy + decorative visual panel).

## Header / masthead
- **Where**: appears in this reference file as the gallery header only.
  Not necessarily present as persistent chrome in the product — the actual
  screens each open directly into their card with no shared top nav bar.
- **Visual**: small signal-tower glyph + "GFOA" wordmark, 13px, letter-
  spaced, brand blue.

## Primary button
- **Where**: landing (Begin the interview), intake (Continue), consent
  (Continue to setup), mic check (Continue), connection-failed (Reconnect).
- **Visual**: solid brand blue, white text, 10px radius.
- **Interaction**: hover darkens to `#14304f`; disabled state greys out
  and removes pointer cursor; loading state dims fill and adds a spinner.
- **Variants**: default, disabled, loading.

## Secondary button
- **Where**: connection-failed ("End for now").
- **Visual**: transparent fill, bordered, neutral text.
- **Interaction**: standard hover/press; always enabled.

## Text input
- **Where**: intake (email, confirm email).
- **Visual**: bordered rectangle, 10px radius, 16px text.
- **Interaction**: focus/typing, then validates on blur or continuous
  match-check.
- **Variants**: default (empty/typing), valid (confirmed, checkmark),
  error (mismatch, red border + message), disabled (during submission).

## Consent control
- **Where**: consent screen.
- **Visual**: single checkbox + label, brand-blue accent color.
- **Interaction**: must be explicitly checked to enable Continue — this is
  the one control gating the primary action, i.e. the explicit affirmative
  consent action. Not a "select all" or pre-checked control.
- **Variants**: unchecked (default) / checked.

## Disclosure panel
- **Where**: consent screen only.
- **Visual**: light-blue-tinted rounded panel holding a checklist of the
  required consent disclosures (AI interviewer, recording/transcription,
  duration, staff review, consent-gates-recording).
- **Interaction**: static/read-only.

## "While you talk" note
- **Where**: consent screen, below the disclosure panel.
- **Visual**: plain bulleted text (not boxed), covering interviewer
  follow-up behavior and the listening pause behavior.
- **Interaction**: static/read-only.

## Mic level meter
- **Where**: mic check screen.
- **Visual**: 5 vertical bars of varying height, animating with a
  staggered bounce while "listening."
- **Interaction**: live-reactive in the real app (bar heights should map
  to actual input level); shown here as a representative animated state.
  A "Test again" link re-triggers the check.
- **Variants**: implied — silence/no signal state is not explicitly
  designed here; recommend reusing the same bars at minimum height rather
  than inventing a new treatment.

## Signal-tower glyph (brand motif)
- **Where**: masthead, landing decorative panel, mic-check heading, and
  (arcs replaced by rings) the live-interview status visual.
- **Visual**: see DESIGN_TOKENS.md "Motif: signal tower."
- **Interaction**: static in masthead/mic-check; continuously animated
  (expanding rings) on landing and during live interview.
- **Variants**: static-with-arcs (masthead, mic check), animated-with-rings
  (landing, live states), dimmed/idle (connecting state — same rings, muted
  color and slower/softer pulse).

## Live interview status visual
- **Where**: all five live-interview states (connecting, interviewer
  speaking, listening, processing, approaching time).
- **Visual**: large circular tinted container (130px) holding the tower
  glyph; ring animation speed/opacity signals state (soft slow pulse =
  connecting, medium ping = interviewer speaking / approaching time, fast
  ping = listening). Processing swaps the tower for three bouncing dots.
- **Interaction**: purely presentational — reflects live call state, no
  direct user interaction on the visual itself.
- **Variants**: connecting, interviewer-speaking, listening, processing,
  approaching-time (interviewer-speaking visual + text pill below it).

## Elapsed time indicator
- **Where**: top-right of every live-interview card (blank during
  connecting).
- **Visual**: quiet 12px grey text, e.g. "6 min elapsed" — no icon, no
  progress bar, no countdown.
- **Interaction**: static text in this reference; would update live in
  the real app. Deliberately not a countdown or alarming color.

## End-interview control
- **Where**: bottom of every live-interview card.
- **Visual**: quiet grey text link/button, not a prominent red "hang up"
  affordance.
- **Interaction**: always available; ends the call immediately, leading to
  the "ended early" ending (or "completed" if the interview had already
  reached its natural end).

## Status icon badge
- **Where**: mic-denied, connection-failed errors; completed, ended-early,
  technical-failure endings.
- **Visual**: circular tinted container with a single glyph (!, ✓, ◐).
- **Interaction**: static/decorative.
- **Variants**: error tint (`#fbeceb` / red glyph), success/neutral tint
  (`#e8eef4` / blue glyph), quiet/technical tint (`#f4f2ee` / grey glyph).

## Reconnecting spinner
- **Where**: connection-dropped error only.
- **Visual**: circular spinner using the error border color, rotating.
- **Interaction**: shown while an automatic reconnect attempt is in
  progress; on failure, transitions to the technical-failure ending rather
  than staying on this screen or showing a manual retry button.

## Gallery-only elements (do not implement)
The following exist only in this reference file to organize the states for
review, and are not part of the participant-facing product:
- Section eyebrow headers with divider lines ("Entry & setup", "Live
  interview", "Interruptions", "Endings").
- State-name pill badges above each card (e.g. "Intake — error").
