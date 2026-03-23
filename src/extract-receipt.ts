import Anthropic from "@anthropic-ai/sdk";
import { analyzeImage } from "./claude-client";
import { extractJson } from "./parse-json";
import { ExtractionResult } from "./types";

const PROMPT = `Analyze this image. First determine if it is a receipt. If it is not a receipt, respond with:
{"isReceipt": false, "vendor": "", "items": [], "total": 0, "currency": ""}

If it is a receipt, extract the following and respond in this exact JSON format and nothing else:
{
  "isReceipt": true,
  "vendor": "<store or business name>",
  "items": [
    {"name": "<item name>", "price": <price as number>}
  ],
  "total": <total amount as number>,
  "currency": "<3-letter currency code e.g. USD, EUR, PHP>"
}

Rules:
- The vendor is the store/restaurant/business where the purchase was made. Look at the header, logo, branding, or feedback URL on the receipt. NEVER use the POS system manufacturer (e.g. NCR Corporation, Epson), payment processor, or printer company as the vendor
- Extract every purchased line item visible on the receipt
- Read item names exactly as printed on the receipt
- Each item must have its own price. If an item has no separate price (e.g. included in a combo), use 0
- Use the final total amount (after tax/discounts) if visible
- If the total is not visible, sum the item prices
- Prices must be numbers, not strings`;

export async function extractReceiptData(
  client: Anthropic,
  imageBuffer: Buffer,
  mimeType: string,
  model?: string
): Promise<ExtractionResult> {
  const response = await analyzeImage(client, imageBuffer, mimeType, PROMPT, model);

  const parsed = extractJson(response) as any;

  return {
    isReceipt: parsed.isReceipt,
    vendor: parsed.vendor,
    items: parsed.items,
    total: parsed.total,
    currency: parsed.currency,
  };
}
