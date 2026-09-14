import type { Json } from "@/types/database.types";

export type AdminStructuredField = {
  fieldName: string;
  value: Json | undefined;
  valueStatus: string;
};

export function parseAdminStructuredFields(
  structuredFields: Json,
): AdminStructuredField[] {
  if (!Array.isArray(structuredFields)) {
    return [];
  }

  return structuredFields.flatMap((field) => {
    if (!isRecord(field)) {
      return [];
    }

    const fieldName = field.field_name;
    const valueStatus = field.value_status;

    if (typeof fieldName !== "string" || typeof valueStatus !== "string") {
      return [];
    }

    return [
      {
        fieldName,
        value: field.value,
        valueStatus,
      },
    ];
  });
}

export function formatAdminStructuredFieldLabel(fieldName: string) {
  const label = formatTitleCase(fieldName);

  return label || "Unnamed field";
}

export function formatAdminStructuredFieldStatus(valueStatus: string) {
  return formatSnakeCase(valueStatus);
}

export function formatAdminStructuredFieldValue(field: AdminStructuredField) {
  if (field.value === null || field.value === undefined || field.value === "") {
    return formatAdminStructuredFieldStatus(field.valueStatus);
  }

  if (typeof field.value === "string") {
    return formatStructuredFieldText(field.value);
  }

  return JSON.stringify(field.value);
}

function formatSnakeCase(value: string) {
  return formatTitleCase(value);
}

function formatTitleCase(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map(formatLabelPart)
    .join(" ");
}

function formatStructuredFieldText(value: string) {
  if (!value.includes("_")) {
    return value;
  }

  const parts = value.split("_").filter(Boolean);
  return parts
    .map((part, index) => {
      const acronym = knownAcronym(part);
      if (acronym) {
        return acronym;
      }

      return index === 0 ? capitalize(part) : part.toLowerCase();
    })
    .join(" ");
}

function formatLabelPart(part: string) {
  return knownAcronym(part) ?? capitalize(part);
}

function knownAcronym(part: string) {
  const knownAcronyms: Record<string, string> = {
    gfoa: "GFOA",
  };

  return knownAcronyms[part.toLowerCase()];
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function isRecord(value: Json): value is Record<string, Json | undefined> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
