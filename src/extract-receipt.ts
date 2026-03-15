import Anthropic from "@anthropic-ai/sdk";
import { analyzeImage } from "./claude-client";
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
- Extract every line item visible on the receipt
- Use the final total (after tax/discounts) if visible
- If the total is not visible, sum the item prices
- Prices must be numbers, not strings`;

export async function extractReceiptData(
  client: Anthropic,
  imageBuffer: Buffer,
  mimeType: string
): Promise<ExtractionResult> {
  const response = await analyzeImage(client, imageBuffer, mimeType, PROMPT);

  const json = response.replace(/```json\n?|```\n?/g, "").trim();
  const parsed = JSON.parse(json);

  return {
    isReceipt: parsed.isReceipt,
    vendor: parsed.vendor,
    items: parsed.items,
    total: parsed.total,
    currency: parsed.currency,
  };
}
