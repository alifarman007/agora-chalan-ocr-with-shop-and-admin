import 'server-only';
import { DeliveryChalanDocument } from "@/types/delivery-chalan";
import { withGeminiFailover } from "./geminiClient";

const DELIVERY_CHALAN_STRUCTURE_PROMPT = `You are a document structure extraction AI specialized in Bangladeshi Delivery Chalans (ডেলিভারি চালান).

You will receive raw OCR text extracted from a delivery chalan image. The text preserves the original layout with line breaks and spacing.

YOUR TASK: Parse this text and extract ALL information into the exact JSON structure specified below.

ABOUT DELIVERY CHALANS:
- They document goods/products being delivered from a supplier to a buyer
- They always have a Chalan Number (চালান নং) and usually a PO Number (Purchase Order / পি.ও. নং)
- They contain a table of products/items with columns like: SL No, Product Name/Description, Quantity, Unit, Rate/Price, Amount/Total
- They may have supplier info, buyer info, delivery address, vehicle info, driver info
- They may contain Bangla text, English text, or mixed
- The column headers and field labels might be in Bangla or English

EXTRACTION RULES:
1. Extract chalan_number and po_number from the header area. If you find text like "Chalan No", "চালান নং", "DC No", "Delivery Chalan No" — that's the chalan number. If you find "PO No", "P.O.", "পি.ও.", "Purchase Order" — that's the PO number.
2. Identify supplier (who is sending goods) and buyer (who is receiving). Look for labels like "From", "Seller", "Supplier", "প্রেরক" for supplier and "To", "Buyer", "Customer", "প্রাপক" for buyer.
3. For the product table: detect the column headers first, then extract each row. Common columns include SL/ক্রমিক, Product/পণ্য, Description/বিবরণ, Quantity/পরিমাণ, Unit/একক, Rate/দর, Amount/টাকা, Total/মোট.
4. For summary: extract subtotal, VAT/tax, discount, grand total, or any other totals at the bottom.
5. Any other fields (Transport/পরিবহন, Vehicle No/গাড়ি নং, Driver/চালক, Remarks/মন্তব্য, etc.) go into additional_metadata.
6. Preserve the original language — do NOT translate Bangla to English or vice versa.
7. If a value is clearly a number, return it as a number type. If it has currency symbols or ambiguity, return as string.
8. Set confidence: 1.0 for clearly readable fields, 0.7-0.9 for partially unclear, below 0.7 for guessed values.

RESPOND WITH ONLY VALID JSON (no markdown, no backticks, no explanation). Use this exact structure:

{
  "document_type": "delivery_chalan",
  "chalan_number": "string or empty string if not found",
  "po_number": "string or empty string if not found",
  "date": "string — the date as written on the chalan, preserve original format",
  "supplier": {
    "name": "string",
    "address": "string or null",
    "phone": "string or null",
    "additional": {}
  },
  "buyer": {
    "name": "string", 
    "address": "string or null",
    "phone": "string or null",
    "additional": {}
  },
  "delivery_address": "string or null",
  "additional_metadata": [
    { "key": "field label", "value": "field value", "field_type": "text|date|number|phone", "confidence": 0.95 }
  ],
  "line_items": {
    "columns": [
      { "id": "snake_case_id", "label": "Display Label", "type": "text|number|currency" }
    ],
    "rows": [
      { "cells": { "column_id": "value for this column" }, "confidence": 0.95 }
    ]
  },
  "summary": [
    { "key": "Total", "value": 50000, "field_type": "currency", "confidence": 0.98 }
  ],
  "ai_confidence": 0.92
}`;

// Helper to generate UUIDs
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export async function structureDeliveryChalan(
  rawOcrText: string,
  modelId: string
): Promise<DeliveryChalanDocument> {
  try {
    const response = await withGeminiFailover((ai) =>
      ai.models.generateContent({
        model: modelId,
        contents: [
          {
            role: "user",
            parts: [{ text: rawOcrText }],
          },
        ],
        config: {
          systemInstruction: DELIVERY_CHALAN_STRUCTURE_PROMPT,
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      })
    );

    if (!response.text) {
      throw new Error("Model returned empty response.");
    }

    // Clean up potential markdown formatting if the model disobeys instructions
    let jsonString = response.text.trim();
    if (jsonString.startsWith('```json')) {
      jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonString.startsWith('```')) {
        jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const parsedData = JSON.parse(jsonString);

    // Hydrate the parsed data with IDs and metadata
    const document: DeliveryChalanDocument = {
      ...parsedData,
      document_type: "delivery_chalan",
      processing_model: modelId,
      processed_at: new Date().toISOString(),
      raw_ocr_text: rawOcrText,
      structuring_usage: response.usageMetadata,
      // Ensure specific arrays exist and have IDs
      additional_metadata: (parsedData.additional_metadata || []).map((item: any) => ({
        ...item,
        id: generateId()
      })),
      line_items: {
        columns: parsedData.line_items?.columns || [],
        rows: (parsedData.line_items?.rows || []).map((row: any) => ({
            ...row,
            id: generateId()
        }))
      },
      summary: (parsedData.summary || []).map((item: any) => ({
        ...item,
        id: generateId()
      }))
    };

    return document;

  } catch (error) {
    // Rethrow untouched — the UI maps every failure to a generic message and the
    // real cause stays in the console for debugging.
    console.error("Structuring Error:", error);
    throw error;
  }
}