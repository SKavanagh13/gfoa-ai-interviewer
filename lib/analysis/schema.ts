import basePostInterviewOutputSchema from "@/schemas/post-interview-output.schema.json";
import { CODED_FIELD_VALUE_OPTIONS, OBJECTIVE_FIELD_NAMES } from "@/lib/analysis/constants";

const objectiveSchema = basePostInterviewOutputSchema.properties.objective_results.items;

// Keep the v3 source schema intact; constrain v4 generation from the same coding rules as validation.
export const postInterviewOutputSchema = {
  ...basePostInterviewOutputSchema,
  properties: {
    ...basePostInterviewOutputSchema.properties,
    objective_results: {
      ...basePostInterviewOutputSchema.properties.objective_results,
      items: {
        ...objectiveSchema,
        properties: {
          ...objectiveSchema.properties,
          structured_fields: {
            type: "array",
            items: {
              anyOf: Object.values(OBJECTIVE_FIELD_NAMES).flat().flatMap((fieldName) => {
                const allowedValues = CODED_FIELD_VALUE_OPTIONS[fieldName];
                const properties = {
                  field_name: { type: "string", enum: [fieldName] },
                };
                return [
                  {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      ...properties,
                      value: allowedValues
                        ? { type: "string", enum: allowedValues }
                        : { type: "string" },
                      value_status: { type: "string", enum: ["supported"] },
                    },
                    required: ["field_name", "value", "value_status"],
                  },
                  {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      ...properties,
                      value: { type: "null" },
                      value_status: { type: "string", enum: ["not_discussed", "unclear"] },
                    },
                    required: ["field_name", "value", "value_status"],
                  },
                ];
              }),
            },
          },
        },
      },
    },
  },
};

export const eligibilityOutputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    eligible: { type: "boolean" },
    supporting_objective: {
      type: ["string", "null"],
      enum: [
        "current_issue",
        "enduring_concern",
        "theory_vs_practice",
        "recent_change",
        "unmet_need",
        "innovation_orientation",
        null,
      ],
    },
    supporting_segment_ids: {
      type: "array",
      items: { type: "string" },
    },
    rationale: { type: "string" },
  },
  required: [
    "eligible",
    "supporting_objective",
    "supporting_segment_ids",
    "rationale",
  ],
} as const;

export function collectObjectSchemaIssues(
  schema: unknown,
  path = "$",
): string[] {
  if (!schema || typeof schema !== "object") {
    return [];
  }

  const value = schema as {
    type?: unknown;
    properties?: Record<string, unknown>;
    items?: unknown;
    additionalProperties?: unknown;
    required?: unknown;
    anyOf?: unknown[];
    oneOf?: unknown[];
  };

  const issues: string[] = [];
  const types = Array.isArray(value.type) ? value.type : [value.type];

  if (types.includes("object")) {
    if (value.additionalProperties !== false) {
      issues.push(`${path} must set additionalProperties: false`);
    }

    const propertyNames = Object.keys(value.properties ?? {});
    const requiredNames = Array.isArray(value.required)
      ? value.required
      : [];

    for (const propertyName of propertyNames) {
      if (!requiredNames.includes(propertyName)) {
        issues.push(`${path}.${propertyName} must be required`);
      }
    }
  }

  for (const [propertyName, child] of Object.entries(value.properties ?? {})) {
    issues.push(...collectObjectSchemaIssues(child, `${path}.${propertyName}`));
  }

  if (value.items) {
    issues.push(...collectObjectSchemaIssues(value.items, `${path}[]`));
  }

  for (const option of [...(value.anyOf ?? []), ...(value.oneOf ?? [])]) {
    issues.push(...collectObjectSchemaIssues(option, path));
  }

  return issues;
}
