import { describe, expect, it } from "vitest";
import {
  formatAdminStructuredFieldLabel,
  formatAdminStructuredFieldStatus,
  formatAdminStructuredFieldValue,
  parseAdminStructuredFields,
} from "@/lib/admin/structured-fields";

describe("Wave 6 admin structured field display", () => {
  it("parses structured field JSON into reviewer-facing rows", () => {
    const fields = parseAdminStructuredFields([
      {
        field_name: "primary_current_issue",
        value: "revenue forecasting",
        value_status: "supported",
      },
      {
        field_name: "secondary_current_issue",
        value: null,
        value_status: "not_discussed",
      },
    ]);

    expect(fields).toHaveLength(2);
    expect(formatAdminStructuredFieldLabel(fields[0].fieldName)).toBe(
      "Primary Current Issue",
    );
    expect(formatAdminStructuredFieldStatus(fields[1].valueStatus)).toBe(
      "Not Discussed",
    );
    expect(formatAdminStructuredFieldValue(fields[0])).toBe(
      "revenue forecasting",
    );
    expect(formatAdminStructuredFieldValue(fields[1])).toBe("Not Discussed");
  });

  it("formats coded values and known acronyms as readable labels", () => {
    const fields = parseAdminStructuredFields([
      {
        field_name: "potential_gfoa_role",
        value: "likely_to_persist",
        value_status: "supported",
      },
      {
        field_name: "evidence_basis",
        value: "direct_experience",
        value_status: "supported",
      },
    ]);

    expect(formatAdminStructuredFieldLabel(fields[0].fieldName)).toBe(
      "Potential GFOA Role",
    );
    expect(formatAdminStructuredFieldValue(fields[0])).toBe("Likely to persist");
    expect(formatAdminStructuredFieldValue(fields[1])).toBe("Direct experience");
  });

  it("ignores malformed JSON entries instead of rendering raw blobs", () => {
    expect(
      parseAdminStructuredFields([
        "not a field",
        { field_name: "missing_status" },
        { value_status: "supported" },
      ]),
    ).toEqual([]);
  });
});
