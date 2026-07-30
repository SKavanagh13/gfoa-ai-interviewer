# Per-Interview Output Specification

## Purpose

The post-interview output converts a completed conversation into a
concise, accurate, and structured representation of the participant’s
perspective. It supports review of individual interviews, comparison
across interviews, identification of recurring themes and emerging
signals, later development of a common taxonomy, and future
decision-logic analysis.

The output should faithfully represent the interview. It should not
exaggerate the significance of what was said, fill gaps through
speculation, or turn one participant’s experience into a claim about the
profession as a whole.

Post-interview analysis is separate from the live interview. The
interviewer’s primary responsibility during the conversation is to
listen and conduct a good interview. After the conversation ends, the
complete transcript should be analyzed against this specification.

## 1. Participant Identity and Profile Context

### Identity Is Collected Before the Voice Interview

The voice interviewer should not spend interview time asking the
participant for their name, title, organization, government type, or
similar administrative information. Participant identity and profile
context should be collected by the application before the interview
begins.

The preferred intake method is for the participant to enter an email
address. The application should use that email address to look for a
matching record in GFOA’s membership database and retrieve available
profile information, such as:

- title;

- government type;

- state or region;

- organization or population size, if available;

- membership category; and

- other approved profile fields relevant to later analysis.

### Confirmation and Missing Information

If a matching member record is found, the application should present the
key information for confirmation before the interview starts. Because
membership records may be incomplete or outdated, the participant should
be able to confirm or correct the information.

If no match is found, the application should request only the minimum
information needed for the project. This fallback intake should occur in
the application interface, not through the voice interviewer, unless a
technical failure makes that impossible.

### Linkage and Privacy

The system should assign a stable participant identifier and a separate
interview identifier. The interview record should link to the
participant profile through those identifiers rather than duplicating
all personal information in every analytical record.

Identity data and interview content should be separable so analysts can
work with de-identified interview records when appropriate. Consent,
disclosure, retention, access, and privacy rules will be developed in a
separate data-governance workstream.

### Permitted Use During the Interview

The interviewer may use confirmed profile information when it materially
improves orientation or avoids asking questions the application already
knows. It should not recite the participant’s profile, call attention to
irrelevant personal information, or introduce details that could make
the interaction feel surveillant.

## 2. General Output Principles

### Accuracy Over Completeness

The analysis should include only what the transcript supports. When an
interview objective was not sufficiently addressed, the output should
state “Not sufficiently discussed” or “Unclear from the interview.” It
should not infer a likely answer merely to complete the output.

A coded value may be assigned only when a specific statement in the
transcript supports it. Inference from tone, plausibility, or
professional stereotype is not sufficient grounds for a value; absent
direct support, the field is recorded as “not discussed” or “unclear.”
No structured field is required to carry a substantive value.

### Fair Representation

The output should represent the participant’s perspective in terms they
would likely recognize as fair. It should preserve important
qualifications, uncertainty, mixed views, tensions, contextual
limitations, and distinctions the participant considered important.

### Description Before Interpretation

The output should distinguish among what the participant explicitly
said, a concise synthesis of what the participant appeared to mean, and
any analytical classification applied for aggregation. Interpretive
labels should never substitute for a clear narrative summary.

### Sufficient, Not Exhaustive

The output should capture the most important information from the
interview. It is not intended to reproduce the entire conversation or
catalog every topic mentioned.

## 3. Required Output Structure

- Interview Overview

- Objective-by-Objective Summary

- Cross-Cutting Themes

- Structured Extraction

- Representative Language

- Analyst Confidence and Limitations

## 4. Interview Overview

### Overall Summary

Provide a paragraph of approximately 100 to 175 words summarizing what
is most demanding the participant’s attention, the most persistent
concern identified, the most important tension or practical challenge
described, the most consequential recent change, the support that would
help, and how the participant evaluates new ideas.

### Primary Takeaway

Provide one sentence completing the idea: “The most important thing to
understand from this interview is that...”

### Notable Additional Issue

Identify any important subject raised outside the six principal
objectives. Use “None identified” when no additional issue emerged.

## 5. Objective-by-Objective Summary

### 1. Current Issue

Narrative summary should state:

- what is currently demanding unusual attention;

- why it is significant;

- whether it is new, worsening, recurring, or unclear.

**Structured fields (populate only when the transcript supports a value;
otherwise “not discussed” or “unclear”):**

- Primary current issue

- Secondary current issue, if material

- Status: new, worsening, recurring, or unclear

- Organizational impact described

- Evidence basis: direct experience, observation, expectation, general
  opinion, or unclear

### 2. Enduring Concern

Narrative summary should state:

- what concern persists beneath changing events;

- why it continues to recur;

- why it is difficult to resolve.

**Structured fields (populate only when the transcript supports a value;
otherwise “not discussed” or “unclear”):**

- Primary enduring concern

- Why it persists

- Main barrier to resolution

- Time horizon: long-standing, likely to persist, uncertain, or unclear

### 3. Theory Versus Practice

Narrative summary should state:

- what principle, expectation, or preferred approach is involved;

- what practical reality conflicts with it;

- what the participant is balancing.

**Structured fields (populate only when the transcript supports a value;
otherwise “not discussed” or “unclear”):**

- Principle or expectation

- Practical constraint

- Competing considerations

- Consequence of the tension

- Concrete example provided: yes, no, or partial

### 4. Recent Change

Narrative summary should state:

- what has changed;

- how it has affected the participant’s job, judgment, risk, or
  uncertainty;

- whether the participant expects it to continue.

**Structured fields (populate only when the transcript supports a value;
otherwise “not discussed” or “unclear”):**

- Change identified

- Type of change: economic, technological, regulatory, political,
  workforce, organizational, community expectations, intergovernmental,
  other, or not yet classified

- Effect on work or decisions

- Expected duration: temporary, continuing, uncertain, or not discussed

### 5. Unmet Need

Narrative summary should state:

- what guidance, tool, service, capacity, or other support is missing;

- what problem the absence creates;

- what effective support would enable;

- whether the participant sees a potential role for GFOA.

**Structured fields (populate only when the transcript supports a value;
otherwise “not discussed” or “unclear”):**

- Unmet need

- Type of support: guidance, training, data, analytical tool,
  technology, peer learning, implementation support, staffing or
  capacity, communication support, advocacy, other, or not yet
  classified

- Desired outcome

- Potential GFOA role: direct, supporting, convening, unclear, or none
  identified

### 6. Innovation Orientation

Narrative summary should state:

- how the participant decides whether a new idea, technology, or
  management practice deserves attention;

- what initially attracts attention;

- what evidence, conditions, or assurances are persuasive before
  adoption.

**Structured fields (populate only when the transcript supports a value;
otherwise “not discussed” or “unclear”):**

- Primary attention trigger

- Principal source of assurance

- Principal source of caution

- Role of peer evidence: high, moderate, low, mixed, or unclear

- Preferred adoption posture: explores early, tests on a limited basis,
  waits for evidence, waits for peer validation, adopts when a clear
  need arises, highly context dependent, unclear, or other

## 6. Cross-Cutting Themes

Cross-cutting items capture patterns that span two or more objectives;
they are distinct from the single-objective fields above and should not
merely restate them.

### Key Tension

State the most important recurring tradeoff or conflict evident across
the interview. Use “No clear cross-cutting tension identified” when
unsupported.

### Recurring Concern

Identify a concern that appears in more than one part of the interview.

### Opportunity Signal

Identify any problem that may warrant further attention by GFOA, GovFi
Solutions, or another provider. Describe the problem and desired outcome
rather than prescribing a product.

### Emerging Signal

Identify any development that appears new, changing, or potentially
important but is not yet well understood.

## 7. Structured Extraction

### Participant Context

Participant context should come from the confirmed application intake
and membership-data enrichment process, not from questions asked by the
voice interviewer. The structured record links to the participant
through the participant identifier and carries only the non-identifying
attributes analysis requires:

- participant identifier;

- interview identifier;

- government type;

- state or region;

- organization or population size band;

- role or title category, if non-identifying;

- years in the profession or experience band, if available;

- interview date; and

- interview duration.

- Direct identifiers — name, email, GFOA member identifier, and
  organization name — are held only in the Layer 1 participant and
  interview record, keyed by the participant identifier, so they are not
  duplicated into analytical records and can be withheld for
  de-identified analysis. Use null or “not collected” for missing
  information. Do not infer demographic characteristics or professional
  details not present in the confirmed profile or transcript.

### Topic Tags

Assign a limited number of descriptive topic tags supported by the
transcript. Ordinarily assign no more than five primary tags,
distinguish primary from secondary topics, and do not create a tag from
every noun mentioned.

### Objective Coverage

For each objective, record: sufficiently covered, partially covered, not
covered, or unclear.

### Overall Interview Quality

Record: strong, adequate, limited, or unusable. This rating reflects
whether the transcript supports fair analysis, not an evaluation of the
participant.

## 8. Representative Language

Select up to three short excerpts that clearly express an important
theme, preserve intended meaning, are understandable without extensive
context, and add value beyond the summary. The model proposes each quote
together with its transcript location. Quote exactness is then enforced
by a deterministic verification step outside the model: each proposed
quote is string-matched against the transcript, and any quote that does
not match verbatim is dropped or flagged rather than published. The
model’s own assurance that a quote is exact is not treated as
verification.

## 9. Confidence and Limitations

For each objective, record high, moderate, or low confidence based on
the strength of the transcript evidence. Confidence reflects the
evidence available, not confidence in the participant’s opinion.

Include a limitations note only when a material issue affects
interpretation, such as missing objectives, poor audio, technical
problems, contradictory responses, leading questions, or early
termination.

## 10. Analytical Guardrails

- Do not infer protected or personal characteristics.

- Do not diagnose personality or infer motives the participant did not
  express.

- Do not label the participant resistant, progressive, sophisticated,
  unsophisticated, or similar.

- Do not treat caution toward innovation as a deficiency or early
  adoption as a virtue.

- Do not claim the participant represents a broader group.

- Do not convert uncertainty into certainty.

- Do not force a response into a category that does not fit.

- Do not invent a response for an objective that was not discussed.

- Do not publish a representative quote unless the deterministic
  transcript-matching step confirms an exact match.

When classification is uncertain, use other, mixed, unclear, or not yet
classified rather than false precision.

## 11. Separation of Outputs

### Layer 1: Participant and Interview Record

Confirmed participant profile, interview metadata, audio, and
transcript.

### Layer 2: Interview Summary

A faithful, human-readable account of the participant’s perspective.

### Layer 3: Analytical Coding

Structured categories and tags used to compare interviews. Analytical
coding must not overwrite or replace the narrative summary.

## 12. Recommended Output Formats

### Human-Readable Report

- Interview Overview

- Objective-by-Objective Summary

- Cross-Cutting Themes

- Representative Quotes

- Confidence and Limitations

### Structured Record

- participant and interview identifiers;

- de-identified participant context;

- objective summaries and coverage;

- coded fields and topic tags;

- representative quote locations;

- confidence ratings; and

- limitations.

The exact technical schema should be developed after the substantive
fields in this specification are approved.

## 13. Relationship to Cross-Interview Analysis

This document defines the output for one interview. The broader value of
the system will come from analyzing patterns across many interviews.
Cross-interview synthesis — including prevalence, breadth, intensity,
novelty, differences among participant groups, and change over time —
will be governed by a separate Cross-Interview Analysis Specification.

The per-interview output is the unit of evidence for that later
analysis. Consistent individual records are therefore necessary, but
this specification should not be mistaken for the final sense-making
product.

## 14. Quality Standard

A successful post-interview output should allow a reviewer who did not
hear the conversation to understand the participant’s perspective
accurately, while allowing another reviewer to trace every important
conclusion back to the transcript. It should be concise enough to review
efficiently, detailed enough to preserve meaning, and structured enough
to support aggregation without creating false certainty.
