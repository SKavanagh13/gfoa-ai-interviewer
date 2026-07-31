import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { getServerEnv } from "@/lib/env";
import {
  ELIGIBILITY_PROMPT_VERSION,
  ELIGIBILITY_SCHEMA_VERSION,
  STRUCTURED_SCHEMA_VERSION,
} from "@/lib/analysis/constants";
import {
  eligibilityOutputSchema,
  postInterviewOutputSchema,
} from "@/lib/analysis/schema";
import type { StructuredOutputModelResult } from "@/lib/analysis/types";
import type { Json } from "@/types/database.types";

const RESPONSES_URL = "https://api.openai.com/v1/responses";

export type AnalysisModelInput = {
  serializedTranscript: string;
  segmentMap: string;
  participantContext: Record<string, string | null>;
};

export async function requestEligibilityClassification(
  input: AnalysisModelInput,
): Promise<StructuredOutputModelResult> {
  return requestStructuredOutput({
    formatName: "gfoa_analysis_eligibility",
    schema: eligibilityOutputSchema,
    systemPrompt: buildEligibilityPrompt(),
    input,
  });
}

export async function requestPostInterviewAnalysis(
  input: AnalysisModelInput,
): Promise<StructuredOutputModelResult> {
  return requestStructuredOutput({
    formatName: "gfoa_post_interview_output",
    schema: postInterviewOutputSchema,
    systemPrompt: await loadPostInterviewPrompt(),
    input,
  });
}

async function requestStructuredOutput({
  formatName,
  schema,
  systemPrompt,
  input,
}: {
  formatName: string;
  schema: unknown;
  systemPrompt: string;
  input: AnalysisModelInput;
}): Promise<StructuredOutputModelResult> {
  const env = getServerEnv();

  const body = {
    model: env.OPENAI_ANALYSIS_MODEL,
    tools: [],
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: systemPrompt }],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify(
              {
                transcript: input.serializedTranscript,
                segment_map: input.segmentMap,
                participant_context: input.participantContext,
                schema_version: STRUCTURED_SCHEMA_VERSION,
              },
              null,
              2,
            ),
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: formatName,
        schema,
        strict: true,
      },
    },
  };

  const response = await fetch(RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const raw = (await response.json()) as Json;

  if (!response.ok) {
    return {
      parsed: null,
      rawResponse: raw,
      usage: extractUsage(raw),
      refusal: null,
      errorMessage: extractApiError(raw) ?? `OpenAI request failed with ${response.status}`,
    };
  }

  const refusal = extractRefusal(raw);
  const text = extractOutputText(raw);

  if (refusal) {
    return {
      parsed: null,
      rawResponse: raw,
      usage: extractUsage(raw),
      refusal,
      errorMessage: "Structured output request was refused.",
    };
  }

  if (!text) {
    return {
      parsed: null,
      rawResponse: raw,
      usage: extractUsage(raw),
      refusal: null,
      errorMessage: "Structured output response did not contain text.",
    };
  }

  try {
    return {
      parsed: JSON.parse(text) as unknown,
      rawResponse: raw,
      usage: extractUsage(raw),
      refusal: null,
      errorMessage: null,
    };
  } catch {
    return {
      parsed: null,
      rawResponse: raw,
      usage: extractUsage(raw),
      refusal: null,
      errorMessage: "Structured output response was not valid JSON.",
    };
  }
}

async function loadPostInterviewPrompt(): Promise<string> {
  return readFile(
    path.join(process.cwd(), "prompts", "post-interview-analysis.system.md"),
    "utf8",
  );
}

function buildEligibilityPrompt(): string {
  return [
    `Version: ${ELIGIBILITY_PROMPT_VERSION}`,
    `Eligibility schema version: ${ELIGIBILITY_SCHEMA_VERSION}`,
    "You are a narrow post-interview eligibility classifier, separate from the live interviewer.",
    "Decide only whether at least one locked interview objective has partial or sufficient coverage.",
    "Coverage requires direct transcript evidence identifying the participant's central point and at least one meaningful dimension such as why it matters, context, example, reasoning, impact, or tradeoff.",
    "Do not summarize the full interview, extract coded fields, propose quotes, infer identities, make recommendations, or classify themes.",
    "Return only the required structured JSON.",
  ].join("\n");
}

function extractOutputText(raw: Json): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const output = raw.output;
  if (!Array.isArray(output)) {
    return null;
  }

  for (const item of output) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    const content = item.content;
    if (!Array.isArray(content)) {
      continue;
    }
    for (const contentItem of content) {
      if (!contentItem || typeof contentItem !== "object" || Array.isArray(contentItem)) {
        continue;
      }
      if (
        contentItem.type === "output_text" &&
        typeof contentItem.text === "string"
      ) {
        return contentItem.text;
      }
    }
  }

  return null;
}

function extractRefusal(raw: Json): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const output = raw.output;
  if (!Array.isArray(output)) {
    return null;
  }

  for (const item of output) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    const content = item.content;
    if (!Array.isArray(content)) {
      continue;
    }
    for (const contentItem of content) {
      if (!contentItem || typeof contentItem !== "object" || Array.isArray(contentItem)) {
        continue;
      }
      if (
        contentItem.type === "refusal" &&
        typeof contentItem.refusal === "string"
      ) {
        return contentItem.refusal;
      }
    }
  }

  return null;
}

function extractUsage(raw: Json) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { inputTokens: null, outputTokens: null };
  }

  const usage = raw.usage;
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) {
    return { inputTokens: null, outputTokens: null };
  }

  return {
    inputTokens:
      typeof usage.input_tokens === "number" ? usage.input_tokens : null,
    outputTokens:
      typeof usage.output_tokens === "number" ? usage.output_tokens : null,
  };
}

function extractApiError(raw: Json): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const error = raw.error;
  if (!error || typeof error !== "object" || Array.isArray(error)) {
    return null;
  }

  return typeof error.message === "string" ? error.message : null;
}
