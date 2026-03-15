export type AuthenticityClassification = "real" | "ai_generated" | "forged";

export interface AuthenticityResult {
  classification: AuthenticityClassification;
  confidence: number;
  reasoning: string;
}

export interface ReceiptItem {
  name: string;
  price: number;
}

export interface ExtractionResult {
  isReceipt: boolean;
  vendor: string;
  items: ReceiptItem[];
  total: number;
  currency: string;
}

export interface ReceiptResult {
  authenticity: AuthenticityResult;
  extraction: ExtractionResult | null;
}

export interface ExtractorOptions {
  apiKey?: string;
  authenticityModel?: string;
  extractionModel?: string;
}
