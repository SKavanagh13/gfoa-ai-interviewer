# The Listening Post — Design Tokens

## Colors

| Token | Hex | Usage |
|---|---|---|
| `color-bg-page` | `#faf9f6` | Page background |
| `color-bg-card` | `#ffffff` | Card/panel background |
| `color-bg-subtle` | `#f4f2ee` / `#f1efec` | Subtle fills (pills, badges) |
| `color-border` | `#e4e2df` | Card borders, dividers |
| `color-border-input` | `#d8d5d0` | Default input border |
| `color-text-primary` | `#232220` | Headings, primary body text |
| `color-text-secondary` | `#55524c` | Supporting body copy |
| `color-text-tertiary` | `#6b6864` | Captions, helper text |
| `color-text-quiet` | `#8a8680` / `#a9a49d` | Quietest text (elapsed time, footnotes) |
| `color-brand-primary` | `#1d3f66` | GFOA blue — primary actions, accents, focus states |
| `color-brand-primary-hover` | `#14304f` | Hover/active state of brand blue |
| `color-brand-tint` | `#e8eef4` | Light blue fill (icon circles, highlight panels) |
| `color-brand-tint-strong` | `#9fb4c7` / `#b7c9d8` | Mid-tone blue (dimmed/disabled tower icon, disabled primary button) |
| `color-error` | `#b3261e` | Error text, error icon |
| `color-error-bg` | `#fbeceb` | Error icon background |
| `color-error-border` | `#f0c9c5` | Error spinner track |

*Note: `#1d3f66` is used as a credible GFOA-blue stand-in — confirm against
GFOA's actual brand guide hex before shipping; swap only this token if it
differs, everything else is unaffected.*

## Typography

- Font family: `'Source Sans 3', -apple-system, sans-serif` (Google Font,
  weights 400/500/600/700).
- H1 (gallery heading only, not part of product UI): 30px / 700.
- H2 (screen titles): 22–34px / 700, line-height ~1.15–1.2.
  - Landing title: 34px. Section titles (intake, consent, mic check): 24px.
    Error/ending titles: 22px.
- Body copy: 15–17px / 400, line-height 1.5–1.6.
- Supporting/caption text: 12–14.5px / 400–600.
- Uppercase eyebrow labels (e.g. "Step 1 of 2"): 12px / 600, letter-spacing
  0.08em, uppercase.
- Buttons: 15–16px / 600.

## Spacing scale

Primarily 4px-based, observed values: 4, 6, 8, 10, 12, 14, 16, 18, 20, 22,
24, 28, 32, 44, 48, 56px. Card internal padding: 40–56px vertical, 40–44px
horizontal. Gaps between stacked elements inside a card: 16–20px typical,
8–10px for tightly related label/input pairs.

## Border radius

- Cards/panels: 16px.
- Buttons, inputs, highlight panels: 10–12px.
- Pills/badges: 999px (fully rounded).
- Icon circles: 50% (circular).

## Shadows

- Card elevation: `0 1px 3px rgba(20,20,15,0.06), 0 8px 24px rgba(20,20,15,0.05)`
  — a soft two-layer shadow, used on every card/panel consistently.

## Buttons

- **Primary**: solid `#1d3f66` fill, white text, 600 weight, 10px radius,
  15px vertical / 24–28px horizontal padding. Hover: `#14304f`.
- **Primary — disabled**: `#e4e2df` fill, `#a9a49d` text, no hover.
- **Primary — loading**: `#b7c9d8` fill (dimmed brand blue), white text,
  inline spinner (14–15px, 2px stroke, white, spins via border-top
  transparent trick) + label change (e.g. "Sending confirmation…").
- **Secondary**: transparent fill, `#6b6864` text, 1px `#d8d5d0` border,
  same radius/padding as primary.
- All buttons: `'Source Sans 3'` font, `cursor: pointer` when enabled.

## Inputs

- Default: 1px `#d8d5d0` border, 10px radius, 14px vertical / 16px
  horizontal padding, 16px font.
- Valid/confirmed: border becomes `#1d3f66`; a small filled circular
  checkmark (18px, brand blue fill, white check) replaces the caret area.
- Error: border becomes `#b3261e`; inline message below in `#b3261e`,
  13px.
- Disabled (e.g. during loading): `#e4e2df` border, `#faf9f6` background,
  `#9a968f` text, no interaction.
- Labels: 14px / 600, `#232220` (dim to `#9a968f` when the input is
  disabled).

## Cards / panels

- White fill, 1px `#e4e2df` border, 16px radius, standard elevation shadow
  (above). Consistent width per context: 600px for single-column screens,
  760px for the two-column landing screen. `max-width: 100%` so cards
  shrink on narrower viewports rather than overflow.
- Highlight sub-panel (used in Consent for the disclosure list): light blue
  fill `#e8eef4`, 12px radius, 22–24px padding, no border.

## Status / icon badges

- Circular icon container, 46–60px, background tinted to match the
  message's tone: `#e8eef4` (brand blue tint, used for success/neutral
  confirmations), `#fbeceb` (error tint), `#f4f2ee` (neutral/quiet, used for
  technical-failure). Icon glyph color matches or contrasts appropriately
  (`#1d3f66`, `#b3261e`, `#8a8680`).
- Eyebrow status pills in this reference file only (e.g. "Intake — error")
  are gallery labels, not part of the product UI — do not implement them.

## Motif: signal tower

A simple radio-tower glyph (vertical mast + tripod base + a few short arcs
at the top representing broadcast signal) recurs across the design as the
product's visual identity:
- Static, full glyph: masthead logo (20px), mic-check heading (40px).
- Static, arcs removed / mast+dot only: small in-context uses where
  animated rings substitute for the arcs (see below).
- Animated: on landing (large, decorative panel) and on the live-interview
  states, the top arcs are replaced by expanding "ping" rings
  (`@keyframes lp-ping` / `lp-ping-fast`, a circle scaling 1→2.1–2.6 while
  fading opacity 0.5–0.7→0) to suggest a live broadcast signal. Speaking/
  listening states use a faster ping cycle than the idle/connecting state
  to differentiate energy level without adding new iconography.
