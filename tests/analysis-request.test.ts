import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { requestPostInterviewAnalysis, requestEligibilityClassification } from "@/lib/openai/analysis";
import { ANALYSIS_PROMPT_VERSION, STRUCTURED_SCHEMA_VERSION, ELIGIBILITY_SCHEMA_VERSION } from "@/lib/analysis/constants";

vi.mock("@/lib/server-runtime-env", () => ({
  getServerRuntimeEnv: () => ({ OPENAI_ANALYSIS_MODEL: "gpt-4o-mini", OPENAI_API_KEY: "test-only" }),
}));

afterEach(() => vi.unstubAllGlobals());

describe("post-interview analysis request", () => {
  it("keeps end disposition out of the content-only eligibility decision", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      output: [{ type: "message", content: [{ type: "output_text", text: "{}" }] }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await requestEligibilityClassification({
      serializedTranscript: "Participant explains a meaningful budget tradeoff.",
      segmentMap: "answer", participantContext: {},
      interviewMetadata: { end_disposition: "technical_failure" },
    });
    const init = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init[1].body as string);
    expect(JSON.parse(body.input[1].content[0].text)).toMatchObject({
      interview_metadata: null, schema_version: ELIGIBILITY_SCHEMA_VERSION,
    });
    expect(body.text.format.name).toBe("gfoa_analysis_eligibility");
  });
  it("sends the locked specification, current prompt, constrained coding, and disposition", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      output: [{ type: "message", content: [{ type: "output_text", text: "{}" }] }],
      usage: { input_tokens: 100, output_tokens: 20 },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestPostInterviewAnalysis({
      serializedTranscript: "[0002] participant: Mandatory changes get our attention and we consult our network.",
      segmentMap: "transcript_label=[0002] | segment_id=answer | speaker=participant | is_final=true",
      participantContext: { government_type: null },
      interviewMetadata: { end_disposition: "technical_failure" },
    });

    expect(result).toMatchObject({ parsed: {}, errorMessage: null, usage: { inputTokens: 100, outputTokens: 20 } });
    const init = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init[1].body as string);
    const instructions = body.input[0].content[0].text;
    const specification = await readFile(path.join(process.cwd(), "docs/locked/03-per-interview-output-specification.md"), "utf8");
    expect(instructions).toContain(specification);
    expect(instructions).toContain(`Version: ${ANALYSIS_PROMPT_VERSION}`);
    expect(body).toMatchObject({ model: "gpt-4o-mini", tools: [], text: { format: { strict: true, type: "json_schema" } } });
    expect(JSON.parse(body.input[1].content[0].text)).toMatchObject({
      schema_version: STRUCTURED_SCHEMA_VERSION,
      interview_metadata: { end_disposition: "technical_failure" },
    });
    const fields = body.text.format.schema.properties.objective_results.items.properties.structured_fields.items.anyOf;
    const support = fields.filter((field: { properties: { field_name: { enum: string[] } } }) =>
      field.properties.field_name.enum.includes("type_of_support"));
    expect(support).toHaveLength(2);
    expect(support[0].properties.value.enum).toContain("analytical_tool");
    expect(support[0].properties.value.enum).not.toContain("technology, data, analytical_tool");
    expect(support[1].properties.value).toEqual({ type: "null" });
  });

  it("preserves the prior prompt and versions the new instructions consistently", async () => {
    const prior = await readFile(path.join(process.cwd(), "prompts/versions/wave5-post-interview-analysis-v4.md"), "utf8");
    const current = await readFile(path.join(process.cwd(), "prompts/post-interview-analysis.system.md"), "utf8");
    expect(prior.startsWith("Version: wave5-post-interview-analysis-v4")).toBe(true);
    expect(current.startsWith(`Version: ${ANALYSIS_PROMPT_VERSION}`)).toBe(true);
    expect(prior).not.toContain("Each coded value must be ONE exact permitted token");
    expect(current).toContain("Each coded value must be ONE exact permitted token");
  });
});
