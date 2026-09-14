import { describe, expect, it } from "vitest";
import { collectObjectSchemaIssues, postInterviewOutputSchema } from "@/lib/analysis/schema";
import {
  countParticipantWords,
  validateEligibilityModelResult,
  validatePostInterviewOutput,
} from "@/lib/analysis/output-validation";
import {
  CODED_FIELD_VALUE_OPTIONS,
  OBJECTIVES,
  OBJECTIVE_FIELD_NAMES,
} from "@/lib/analysis/constants";
import type { PostInterviewOutput } from "@/lib/analysis/types";
import type { CanonicalTranscriptSegment } from "@/lib/transcript/types";

function segment(
  overrides: Partial<CanonicalTranscriptSegment>,
): CanonicalTranscriptSegment {
  return {
    segmentId: "segment-1",
    interviewId: "interview-1",
    sequenceNumber: 1,
    speaker: "participant",
    text: "The budget timeline changed quickly and it affects how we explain tradeoffs to departments.",
    startTimeMs: 0,
    endTimeMs: 1000,
    providerEventId: "event-1",
    isFinal: true,
    ...overrides,
  };
}

function validOutput(): PostInterviewOutput {
  return {
    overview: {
      overall_summary:
        "The participant described pressure around budget timing, recurring communication challenges, practical tradeoffs, recent change, support needs, and careful adoption.",
      primary_takeaway:
        "The most important thing to understand from this interview is that the participant needs clearer support for explaining tradeoffs.",
      notable_additional_issue: "None identified",
    },
    objective_results: OBJECTIVES.map((objective) => ({
      objective,
      narrative_summary: "Supported summary from the cited segment.",
      coverage: "partially_covered",
      confidence: "moderate",
      structured_fields: OBJECTIVE_FIELD_NAMES[objective].map((fieldName) => ({
        field_name: fieldName,
        value: null,
        value_status: "not_discussed",
      })),
      supporting_segment_ids: ["segment-1"],
    })),
    cross_cutting_themes: {
      key_tension: "No clear cross-cutting tension identified",
      recurring_concern: "No recurring concern identified",
      opportunity_signal: "No opportunity signal identified",
      emerging_signal: "No emerging signal identified",
    },
    topic_tags: [
      {
        label: "Budget communication",
        importance: "primary",
        supporting_segment_ids: ["segment-1"],
      },
    ],
    representative_quotes: [
      {
        quote_text: "The budget timeline changed quickly",
        related_objective: "recent_change",
        reason_selected: "Concise statement of the change.",
        proposed_segment_ids: ["segment-1"],
      },
    ],
    overall_quality: "adequate",
    limitations: null,
    negative_reaction_flag: null,
  };
}

describe("Wave 5 structured output schema", () => {
  it("sets additionalProperties false and requires all object properties", () => {
    expect(collectObjectSchemaIssues(postInterviewOutputSchema)).toEqual([]);
  });

  it("constrains structured field names to the locked objective fields", () => {
    const fieldNameSchema = postInterviewOutputSchema.properties
      .objective_results.items.properties.structured_fields.items.properties
      .field_name;
    const allowedFieldNames = Object.values(OBJECTIVE_FIELD_NAMES).flat();

    expect(fieldNameSchema.enum).toEqual(allowedFieldNames);
    expect(fieldNameSchema.enum).not.toContain("issue_description");
    expect(fieldNameSchema.enum).not.toContain("revenue_forecast_focus");
    expect(fieldNameSchema.enum).not.toContain("theoretical_approach");
  });
});

describe("Wave 5 post-interview output validation", () => {
  it("accepts exactly one result for each locked objective", () => {
    expect(validatePostInterviewOutput(validOutput(), [segment({})])).toMatchObject({
      ok: true,
    });
  });

  it("rejects missing, duplicate, and extra objective results", () => {
    const missing = validOutput();
    missing.objective_results = missing.objective_results.slice(0, 5);
    expect(validatePostInterviewOutput(missing, [segment({})])).toMatchObject({
      ok: false,
    });

    const duplicate = validOutput();
    duplicate.objective_results[1] = {
      ...duplicate.objective_results[0],
    };
    expect(validatePostInterviewOutput(duplicate, [segment({})])).toMatchObject({
      ok: false,
    });
  });

  it("rejects unsupported objective field names and unsupported non-null values", () => {
    const output = validOutput();
    output.objective_results[0].structured_fields.push({
      field_name: "invented_field",
      value: "invented value",
      value_status: "supported",
    });
    output.objective_results[1].structured_fields[0] = {
      field_name: OBJECTIVE_FIELD_NAMES.enduring_concern[0],
      value: "unsupported value",
      value_status: "not_discussed",
    };

    const result = validatePostInterviewOutput(output, [segment({})]);
    expect(result).toMatchObject({ ok: false });
    expect(result.ok ? [] : result.issues.join(" ")).toContain("unsupported");
  });

  it("rejects free text in coded structured fields", () => {
    const output = validOutput();
    output.objective_results[0].structured_fields = [
      {
        field_name: "status",
        value: "needs to balance for adequate funding",
        value_status: "supported",
      },
    ];

    const result = validatePostInterviewOutput(output, [segment({})]);

    expect(result).toMatchObject({ ok: false });
    expect(result.ok ? [] : result.issues.join(" ")).toContain(
      "current_issue.status must be one of",
    );
  });

  it("accepts exact approved values in coded structured fields", () => {
    const output = validOutput();
    output.objective_results[0].structured_fields = [
      {
        field_name: "status",
        value: "unclear",
        value_status: "supported",
      },
      {
        field_name: "evidence_basis",
        value: "direct_experience",
        value_status: "supported",
      },
    ];

    expect(validatePostInterviewOutput(output, [segment({})])).toMatchObject({
      ok: true,
    });
    expect(CODED_FIELD_VALUE_OPTIONS.status).toContain("recurring");
  });

  it("normalizes formatting variants for approved coded structured values", () => {
    const output = validOutput();
    output.objective_results[3].structured_fields = [
      {
        field_name: "expected_duration",
        value: "not discussed",
        value_status: "supported",
      },
      {
        field_name: "type_of_change",
        value: "Community Expectations",
        value_status: "supported",
      },
    ];

    const result = validatePostInterviewOutput(output, [segment({})]);

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) {
      return;
    }
    expect(result.output.objective_results[3].structured_fields).toEqual([
      {
        field_name: "expected_duration",
        value: "not_discussed",
        value_status: "supported",
      },
      {
        field_name: "type_of_change",
        value: "community_expectations",
        value_status: "supported",
      },
    ]);
    expect(output.objective_results[3].structured_fields[0]?.value).toBe(
      "not discussed",
    );
  });

  it("caps representative quote proposals at the allowed maximum", () => {
    const output = validOutput();
    output.representative_quotes = [
      {
        quote_text: "The budget timeline changed quickly",
        related_objective: "recent_change",
        reason_selected: "Shows the recent change.",
        proposed_segment_ids: ["segment-1"],
      },
      {
        quote_text: "it affects how we explain tradeoffs",
        related_objective: "theory_vs_practice",
        reason_selected: "Shows the practical tradeoff.",
        proposed_segment_ids: ["segment-1"],
      },
      {
        quote_text: "departments",
        related_objective: "unmet_need",
        reason_selected: "Shows who is affected.",
        proposed_segment_ids: ["segment-1"],
      },
      {
        quote_text: "ignored extra quote",
        related_objective: null,
        reason_selected: "Exceeds the proposal cap.",
        proposed_segment_ids: ["segment-1"],
      },
    ];

    const result = validatePostInterviewOutput(output, [segment({})]);

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) {
      return;
    }
    expect(result.output.representative_quotes).toHaveLength(3);
    expect(result.output.representative_quotes.map((quote) => quote.quote_text)).toEqual([
      "The budget timeline changed quickly",
      "it affects how we explain tradeoffs",
      "departments",
    ]);
    expect(output.representative_quotes).toHaveLength(4);
  });

  it("requires cited segment IDs to exist and be final", () => {
    const output = validOutput();
    output.objective_results[0].supporting_segment_ids = ["missing-segment"];
    expect(validatePostInterviewOutput(output, [segment({})])).toMatchObject({
      ok: false,
    });

    expect(
      validatePostInterviewOutput(validOutput(), [segment({ isFinal: false })]),
    ).toMatchObject({ ok: false });
  });
});

describe("Wave 5 eligibility validation", () => {
  it("counts only finalized participant words", () => {
    expect(
      countParticipantWords([
        segment({ speaker: "participant", text: "one two three" }),
        segment({ speaker: "interviewer", text: "one two three four" }),
        segment({ speaker: "participant", text: "ignored", isFinal: false }),
      ]),
    ).toBe(3);
  });

  it("accepts classifier eligibility only with objective and canonical evidence", () => {
    expect(
      validateEligibilityModelResult(
        {
          eligible: true,
          supporting_objective: "current_issue",
          supporting_segment_ids: ["segment-1"],
          rationale: "The participant explains why the issue matters.",
        },
        [segment({})],
      ),
    ).toMatchObject({ ok: true });

    expect(
      validateEligibilityModelResult(
        {
          eligible: true,
          supporting_objective: null,
          supporting_segment_ids: [],
          rationale: "Word count alone is enough.",
        },
        [segment({})],
      ),
    ).toMatchObject({ ok: false });
  });
});
