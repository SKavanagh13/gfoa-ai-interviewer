import { describe, expect, it } from "vitest";
import { estimateModelCostUsd } from "@/lib/cost-estimation";

describe("stabilization cost estimation", () => {
  it("estimates analysis text-token cost for configured model pricing", () => {
    expect(
      estimateModelCostUsd({
        model: "gpt-4o-mini",
        inputTokens: 1_000_000,
        outputTokens: 500_000,
      }),
    ).toBe(0.45);
  });

  it("estimates realtime live-token cost separately from analysis pricing", () => {
    expect(
      estimateModelCostUsd({
        model: "gpt-realtime",
        inputTokens: 10_000,
        outputTokens: 5_000,
      }),
    ).toBe(0.64);
  });

  it("leaves cost unknown when pricing or complete usage is unavailable", () => {
    expect(
      estimateModelCostUsd({
        model: "future-model",
        inputTokens: 100,
        outputTokens: 100,
      }),
    ).toBeNull();
    expect(
      estimateModelCostUsd({
        model: "gpt-4o-mini",
        inputTokens: 100,
        outputTokens: null,
      }),
    ).toBeNull();
  });
});
