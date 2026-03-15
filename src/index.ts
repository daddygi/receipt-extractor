import { createClient } from "./claude-client";
import { validateImage } from "./validate-image";
import { checkAuthenticity } from "./check-authenticity";
import { extractReceiptData } from "./extract-receipt";
import { ReceiptResult, ExtractorOptions } from "./types";

export { ReceiptResult, ExtractorOptions, AuthenticityResult, ExtractionResult, ReceiptItem, AuthenticityClassification } from "./types";
export { ReceiptExtractorError } from "./errors";

export async function extractReceipt(
  imageBuffer: Buffer,
  options: ExtractorOptions = {}
): Promise<ReceiptResult> {
  const validation = validateImage(imageBuffer);

  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const client = createClient(options.apiKey);
  const mimeType = validation.mimeType!;

  const authenticity = await checkAuthenticity(client, imageBuffer, mimeType);

  if (authenticity.classification !== "real") {
    return { authenticity, extraction: null };
  }

  const extraction = await extractReceiptData(client, imageBuffer, mimeType);

  if (!extraction.isReceipt) {
    return { authenticity, extraction: null };
  }

  return { authenticity, extraction };
}
