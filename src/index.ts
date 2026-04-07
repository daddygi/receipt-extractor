import { createClient } from "./claude-client";
import { validateImage } from "./validate-image";
import { checkAuthenticity } from "./check-authenticity";
import { extractReceiptData } from "./extract-receipt";
import { extractTextFromImage } from "./ocr";
import { ReceiptExtractorError } from "./errors";
import { ReceiptResult, ExtractorOptions, TokenUsage } from "./types";

export { ReceiptResult, ExtractorOptions, AuthenticityResult, ExtractionResult, ReceiptItem, AuthenticityClassification, MetadataAnalysis, MetadataFlag, TokenUsage } from "./types";
export { ReceiptExtractorError } from "./errors";
export { extractTextFromImage, OcrOptions } from "./ocr";

export async function extractReceipt(
  imageBuffer: Buffer,
  options: ExtractorOptions = {}
): Promise<ReceiptResult> {
  const validation = validateImage(imageBuffer);

  if (!validation.valid) {
    throw new ReceiptExtractorError(validation.error!, "INVALID_IMAGE");
  }

  const client = createClient(options.apiKey);
  const mimeType = validation.mimeType!;
  const ocrOptions = { ollamaUrl: options.ollamaUrl, ocrModel: options.ocrModel };
  const ocrText = await extractTextFromImage(imageBuffer, ocrOptions).catch(() => null);

  const authenticity = await checkAuthenticity(client, imageBuffer, mimeType, options.authenticityModel, ocrText);

  if (authenticity.classification !== "real") {
    return { authenticity, extraction: null, usage: authenticity.usage };
  }

  const extraction = await extractReceiptData(client, imageBuffer, mimeType, options.extractionModel, ocrText);

  const usage: TokenUsage = {
    inputTokens: authenticity.usage.inputTokens + extraction.usage.inputTokens,
    outputTokens: authenticity.usage.outputTokens + extraction.usage.outputTokens,
  };

  if (!extraction.isReceipt) {
    return { authenticity, extraction: null, usage };
  }

  return { authenticity, extraction, usage };
}
