import 'server-only';
import { GenerateContentResponse } from "@google/genai";
import { ModelType, OCRResult } from "@/types/ocr";
import { withGeminiFailover } from "./geminiClient";

export const performOCR = async (
  base64Data: string,
  mimeType: string,
  model: ModelType
): Promise<OCRResult> => {
  // Prompt engineering for layout preservation and language support
  const systemInstruction = `
    You are OCR Agent, an advanced Optical Character Recognition (OCR) engine.
    Your task is to transcribe the content of the provided document (Image or PDF) with extreme accuracy.

    Key Directives:
    1. **Text Extraction**: Extract all visible text, including headers, footers, tables, and sidebar notes.
    2. **Language Support**: The document may contain English, Bangla (Bengali), or a mix of both. Accurately transcribe characters from both scripts.
    3. **Layout Preservation**: strictly preserve the visual structure of the original document.
       - Match line breaks exactly.
       - Use spacing to simulate column alignment (e.g., in receipts or challans).
       - Maintain paragraph separation.
    4. **Document Types**: The input may be a Challan, Official Letter, Receipt, Invoice, Legal Summons, or Fee Payment slip. Treat form fields and tabular data with care to maintain readability.
    5. **Output Format**: Return ONLY the raw extracted text. Do not add markdown formatting (like bold/italic) unless it helps preserve the visual hierarchy. Do not add conversational filler like "Here is the text".
  `;

  try {
    const response: GenerateContentResponse = await withGeminiFailover((ai) =>
      ai.models.generateContent({
        model: model,
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
            {
              text: "Perform OCR on this document. Preserve layout and Bangla/English text exactly as it appears.",
            },
          ],
        },
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.1, // Low temperature for higher fidelity/accuracy
        },
      })
    );

    if (!response.text) {
      throw new Error("No text extraction returned from the model.");
    }

    return {
      text: response.text,
      usageMetadata: response.usageMetadata,
      modelUsed: model,
    };
  } catch (error) {
    console.error("OCR Error:", error);
    throw error;
  }
};