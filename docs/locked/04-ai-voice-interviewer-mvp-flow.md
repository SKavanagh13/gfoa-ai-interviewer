# AI Voice Interviewer MVP Flow

## Purpose

Define the minimum end-to-end system needed to conduct a voice
interview, preserve a reliable source record, create an honest
per-interview output, and make the result reviewable. Cross-interview
analytics and dashboards are intentionally out of scope until real
records exist.

## 1. Participant Intake and Identity Resolution

- Participant enters an email address before the voice interview begins.

- The application attempts to match the email to GFOA’s membership
  database.

- The participant confirms the email address before proceeding.

- If a match is found, available profile information may be linked to the
  interview record for authorized review and later analysis without
  asking the participant to confirm or correct profile fields during the
  MVP intake flow.

- If no match is found, the application proceeds without collecting
  additional participant profile fields. Missing profile fields remain
  null or “not collected.”

- The application creates a stable participant identifier. Direct
  identifiers remain in the participant layer and are not copied into
  analytical records.

## 2. Disclosure and Consent

- Present AI disclosure, recording and transcription notice, intended
  use, and consent language before the interview.

- Record the consent version and timestamp.

- Do not start audio capture until consent is recorded.

## 3. Live Voice Interview

- Create a unique interview identifier linked to the participant
  identifier.

- Run the interview using the locked Operating Principles and Interview
  Guide.

- Supply elapsed time or a near-limit signal from the application layer
  so the interviewer can pace and perform the approved time check-in.

- Stream or save audio and produce a speaker-attributed transcript with
  timestamps or segment locations.

- The voice interviewer does not ask for name, title, organization, or
  other intake information.

- On interview end, record an end disposition from observable signals:
  completed (the interviewer ran its closing), participant_ended (the
  participant left before the closing), or technical_failure (dropped
  connection or component error).

## 4. Canonical Source Record

- Store the audio file in protected object storage.

- Treat the ordered transcript_segments as the canonical transcript. Any
  transcript file in object storage is a serialization derived from
  those segments, not an independent copy. Quote matching and all
  source-segment references operate on the same segment text.

- Preserve timestamps, speaker labels, ordering, and technical quality
  flags.

- Treat the transcript—not the analysis—as the evidentiary source for
  every summary, code, and quote.

## 5. Post-Interview Analysis

- Run a separate analysis process against the complete transcript using
  the locked Per-Interview Output Specification.

- Analysis eligibility is decided by transcript content, not by how the
  interview ended. A session is eligible when at least one objective was
  substantively addressed (the minimum-content threshold), regardless of
  whether its disposition is completed or participant_ended. An eligible
  early-ended session is analyzed and its coverage recorded as partial.
  A session below the threshold is marked
  ineligible_insufficient_content and is retained but not analyzed; its
  record and disposition are preserved, never discarded.

- For every coded field, require transcript support; otherwise store
  “not discussed” or “unclear.”

- Create a human-readable summary, objective-level results, coverage and
  confidence ratings, cross-cutting themes, and proposed representative
  quotes.

- Keep direct identifiers out of the analytical record. Carry only the
  participant identifier, interview identifier, and approved
  non-identifying context.

- Preserve the raw model output and analysis-version metadata so
  analyses can be rerun without overwriting prior results.

## 6. Deterministic Validation

- String-match every proposed quote against the canonical segment text
  using a case- and whitespace-insensitive exact substring match over a
  contiguous span; drop or flag any quote that does not match.

- Validate structured output against the JSON schema and allowed values.

- Flag missing source references, malformed records, and analysis
  failures for review.

## 7. Storage Model

| Table               | MVP purpose                                                                                                                                                                                                                                                                                                                                                                                                                                         |
|---------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| participants        | Direct identifiers and confirmed profile; tightly permissioned.                                                                                                                                                                                                                                                                                                                                                                                     |
| interviews          | Session lifecycle, timestamps, duration, consent version, prompt and guide versions, and storage paths. Lifecycle fields: end_disposition (completed \| participant_ended \| technical_failure); analysis_eligibility (eligible \| ineligible_insufficient_content); negative_reaction_flag (nullable, set by analysis or a reviewer), held as interview-experience metadata and never propagated into objective results or the analytical dataset. |
| transcript_segments | Speaker-attributed transcript turns with sequence and timestamps.                                                                                                                                                                                                                                                                                                                                                                                   |
| analysis_runs       | One record per analysis attempt; model, prompt version, output-spec version, raw output, and status (pending \| succeeded \| failed).                                                                                                                                                                                                                                                                                                               |
| objective_results   | Six records per analysis with narrative, supported structured fields, coverage, confidence, and source segment references.                                                                                                                                                                                                                                                                                                                          |
| quotes              | Proposed quote, source location, deterministic verification status.                                                                                                                                                                                                                                                                                                                                                                                 |
| theme_assignments   | Lightweight plain-language labels and evidence references; no formal taxonomy yet.                                                                                                                                                                                                                                                                                                                                                                  |

## 8. Basic Admin Review Screen

- Show interview status and technical quality flags.

- Show confirmed non-identifying participant context by default, with
  identified details available only to authorized users.

- Describe this as a record with identifiers separated at the profile
  level rather than fully de-identified: participants may speak
  identifying information during the interview, so transcript-content
  redaction remains a separate governance workstream.

- Display audio, transcript, per-interview summary, six objective
  results, confidence, limitations, and quote verification status.

- Allow a reviewer to trace every important output back to transcript
  segments.

- Allow a reviewer to set or confirm the negative_reaction_flag when the
  transcript indicates that the participant reacted negatively to the AI
  interview itself. This flag is experience metadata about the method
  and is kept separate from the six-objective analysis.

- Provide rerun capability that creates a new analysis record rather
  than overwriting the old one.

## 9. First Milestone

A single real end-to-end session that successfully produces:

- a confirmed participant record and consent record;

- a completed voice interview with audio and segmented transcript;

- an analytical record with direct profile identifiers separated from
  the analysis layer;

- six objective results populated only where supported;

- quotes that pass deterministic transcript matching; and

- a reviewable admin view with traceability to source segments.

## Explicitly Out of Scope for the MVP

- Cross-interview dashboards, prevalence claims, trend analysis, and
  segment comparisons.

- A fixed theme taxonomy or decision-logic personas.

- Automated recommendations for GFOA or GovFi Solutions.

- Public-facing reporting.

- Advanced workflow automation beyond processing and review.
