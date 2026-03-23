export type AuthenticityClassification = "real" | "ai_generated" | "forged";

export interface MetadataFlag {
  type: "suspicious" | "positive";
  code: string;
  description: string;
}

export interface MetadataAnalysis {
  hasExif: boolean;
  flags: MetadataFlag[];
  software?: string;
  cameraMake?: string;
  cameraModel?: string;
  dateTime?: string;
  hasGps: boolean;
}

export interface AuthenticityResult {
  classification: AuthenticityClassification;
  confidence: number;
  reasoning: string;
  metadata: MetadataAnalysis;
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
