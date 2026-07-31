import postInterviewOutputSchema from "@/schemas/post-interview-output.schema.json";

export { postInterviewOutputSchema };

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
