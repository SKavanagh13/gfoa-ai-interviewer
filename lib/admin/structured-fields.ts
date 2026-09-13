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
  const label = fieldName
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

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
    return field.value;
  }

  return JSON.stringify(field.value);
}

function formatSnakeCase(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isRecord(value: Json): value is Record<string, Json | undefined> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
