import Anthropic from "@anthropic-ai/sdk";
import { analyzeImage } from "./claude-client";
import { extractJson } from "./parse-json";
import { ExtractionResult } from "./types";

const PROMPT = `Analyze this image. First determine if it is a receipt. If it is not a receipt, respond with:
{"isReceipt": false, "vendor": "", "items": [], "total": 0, "currency": "", "receiptNumber": null, "purchaseDate": null}

If it is a receipt, extract the following and respond in this exact JSON format and nothing else:
{
  "isReceipt": true,
  "vendor": "<store or business name>",
  "items": [
    {"name": "<item name>", "price": <price as number>}
  ],
  "total": <total amount as number>,
  "currency": "<3-letter currency code e.g. USD, EUR, PHP>",
  "receiptNumber": "<transaction ID, order number, or receipt number>",
  "purchaseDate": "<date in YYYY-MM-DD format>"
}

Rules:
- The vendor is the store/restaurant/business where the purchase was made. Look at the header, logo, branding, or feedback URL on the receipt. NEVER use the POS system manufacturer (e.g. NCR Corporation, Epson), payment processor, or printer company as the vendor
- Extract every purchased line item visible on the receipt
- Read item names exactly as printed on the receipt
- Each item must have its own price. If an item has no separate price (e.g. included in a combo), use 0
- Use the final total amount (after tax/discounts) if visible
- If the total is not visible, sum the item prices
- Prices must be numbers, not strings
- For receiptNumber, look for any transaction ID, order number, receipt number, or similar unique identifier. Use null if not found
- For purchaseDate, look for the transaction date printed on the receipt and format it as YYYY-MM-DD. Use null if not found`;

export async function extractReceiptData(
  client: Anthropic,
  imageBuffer: Buffer,
  mimeType: string,
  model?: string,
  ocrText?: string | null
): Promise<ExtractionResult> {
  const ocrContext = ocrText
    ? `\n\nOCR TEXT (extracted by a separate OCR model — use this as the primary source for text data):\n---\n${ocrText}\n---\nUse this OCR text to accurately extract item names, prices, totals, and other details. The OCR text is more reliable than trying to read the image directly.`
    : "";
  const { text: response, usage } = await analyzeImage(client, imageBuffer, mimeType, PROMPT + ocrContext, model);

  const parsed = extractJson(response) as any;

  return {
    isReceipt: parsed.isReceipt,
    vendor: parsed.vendor,
    items: parsed.items,
    total: parsed.total,
    currency: parsed.currency,
    receiptNumber: parsed.receiptNumber ?? null,
    purchaseDate: parsed.purchaseDate ?? null,
    usage,
  };
}
