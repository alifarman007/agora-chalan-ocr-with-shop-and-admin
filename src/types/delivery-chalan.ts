// types/delivery-chalan.ts

// ============================================
// DELIVERY CHALAN STRUCTURED DATA TYPES
// ============================================

import { UsageMetadata } from "./ocr";

/**
 * The complete structured representation of a Delivery Chalan.
 * This is the main data object that flows through the entire pipeline:
 * AI Output → Editor State → API Submission
 */
export interface DeliveryChalanDocument {
  document_type: "delivery_chalan";
  
  // --- Header / Identity ---
  chalan_number: string;
  po_number: string;               // Purchase Order number — always present in delivery chalans
  date: string;                     // Date of the chalan (as extracted, preserve original format)
  
  // --- Parties ---
  supplier: PartyInfo;
  buyer: PartyInfo;
  delivery_address?: string;
  
  // --- Additional Metadata (dynamic key-value for any extra fields) ---
  additional_metadata: MetadataField[];
  
  // --- Line Items (Products being delivered) ---
  line_items: {
    columns: ColumnDefinition[];
    rows: LineItemRow[];
  };
  
  // --- Summary / Totals ---
  summary: SummaryField[];
  
  // --- Processing Info ---
  raw_ocr_text: string;
  ai_confidence: number;
  processing_model: string;
  processed_at: string;

  // --- Analytics ---
  ocr_usage?: UsageMetadata;
  structuring_usage?: UsageMetadata;
}

export interface PartyInfo {
  name: string;
  address?: string;
  phone?: string;
  additional?: Record<string, string>;  // Any extra fields like TIN, BIN, etc.
}

export interface MetadataField {
  id: string;                       // UUID for React key
  key: string;                      // Field label (e.g., "Transport", "Driver Name", "Vehicle No", "গাড়ি নং")
  value: string;
  field_type: "text" | "date" | "number" | "phone";
  confidence: number;               // 0.0 to 1.0 — AI confidence for this field
}

export interface ColumnDefinition {
  id: string;                       // Unique column identifier (e.g., "sl_no", "product_name", "quantity")
  label: string;                    // Display label (can be Bangla — e.g., "পণ্যের নাম", "পরিমাণ")
  type: "text" | "number" | "currency";
  width?: number;                   // Optional width hint (percentage)
}

export interface LineItemRow {
  id: string;                       // UUID for React key
  cells: Record<string, string | number>;  // Maps column.id → cell value
  confidence: number;               // Row-level confidence
}

export interface SummaryField {
  id: string;                       // UUID for React key
  key: string;                      // "Subtotal", "VAT", "Discount", "Grand Total", "মোট"
  value: string | number;
  field_type: "currency" | "percentage" | "text" | "number";
  confidence: number;
}

// ============================================
// API SUBMISSION TYPES
// ============================================

export interface SubmitChalanRequest {
  document: DeliveryChalanDocument;
  source_image_url?: string;
  corrections_made: boolean;
  correction_count: number;
}

export interface SubmitChalanResponse {
  id: string;
  status: "success" | "error";
  message?: string;
  errors?: { field: string; message: string }[];
}

// ============================================
// EDITOR STATE TYPES
// ============================================

export interface EditorState {
  document: DeliveryChalanDocument;
  isDirty: boolean;                 // Has user made changes?
  correctionCount: number;          // How many fields were edited
  isSubmitting: boolean;
  submitError: string | null;
  submitSuccess: boolean;
}