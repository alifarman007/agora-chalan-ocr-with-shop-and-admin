import { ModelType, CostEstimate } from "@/types/ocr";

// Estimated prices per 1 Million tokens (USD)
// These are approximations based on public pricing for estimation purposes.
const PRICING = {
  [ModelType.GEMINI_3_PRO]: { input: 1.25, output: 5.00 },
  [ModelType.GEMINI_3_FLASH]: { input: 0.10, output: 0.40 },
  [ModelType.GEMINI_3_6_FLASH]: { input: 0.10, output: 0.40 },
  [ModelType.GEMINI_2_5_FLASH]: { input: 0.10, output: 0.40 },
};

export const calculateCost = (
  model: ModelType,
  inputTokens: number,
  outputTokens: number
): CostEstimate => {
  const rates = PRICING[model] || PRICING[ModelType.GEMINI_3_FLASH];

  const inputCost = (inputTokens / 1_000_000) * rates.input;
  const outputCost = (outputTokens / 1_000_000) * rates.output;

  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
  };
};