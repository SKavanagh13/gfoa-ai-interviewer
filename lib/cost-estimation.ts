export type ModelPricing = {
  inputUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
};

const MODEL_PRICING: Record<string, ModelPricing> = {
  "gpt-4o-mini": {
    inputUsdPerMillionTokens: 0.15,
    outputUsdPerMillionTokens: 0.6,
  },
  "gpt-4o-mini-2024-07-18": {
    inputUsdPerMillionTokens: 0.15,
    outputUsdPerMillionTokens: 0.6,
  },
  "gpt-4o": {
    inputUsdPerMillionTokens: 2.5,
    outputUsdPerMillionTokens: 10,
  },
  "gpt-4o-2024-11-20": {
    inputUsdPerMillionTokens: 2.5,
    outputUsdPerMillionTokens: 10,
  },
  "gpt-4o-2024-08-06": {
    inputUsdPerMillionTokens: 2.5,
    outputUsdPerMillionTokens: 10,
  },
  "gpt-realtime": {
    inputUsdPerMillionTokens: 32,
    outputUsdPerMillionTokens: 64,
  },
  "gpt-4o-mini-realtime-preview": {
    inputUsdPerMillionTokens: 10,
    outputUsdPerMillionTokens: 20,
  },
  "gpt-4o-mini-realtime-preview-2024-12-17": {
    inputUsdPerMillionTokens: 10,
    outputUsdPerMillionTokens: 20,
  },
  "gpt-4o-realtime-preview": {
    inputUsdPerMillionTokens: 40,
    outputUsdPerMillionTokens: 80,
  },
  "gpt-4o-realtime-preview-2024-12-17": {
    inputUsdPerMillionTokens: 40,
    outputUsdPerMillionTokens: 80,
  },
};

export function estimateModelCostUsd(input: {
  model: string;
  inputTokens: number | null | undefined;
  outputTokens: number | null | undefined;
}): number | null {
  const pricing = MODEL_PRICING[input.model];

  if (!pricing || input.inputTokens === null || input.inputTokens === undefined) {
    return null;
  }

  if (input.outputTokens === null || input.outputTokens === undefined) {
    return null;
  }

  const cost =
    (input.inputTokens / 1_000_000) * pricing.inputUsdPerMillionTokens +
    (input.outputTokens / 1_000_000) * pricing.outputUsdPerMillionTokens;

  return roundCostUsd(cost);
}

export function roundCostUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
