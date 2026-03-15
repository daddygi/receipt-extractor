import { ReceiptExtractorError } from "./errors";

export function extractJson(response: string): unknown {
  const cleaned = response.replace(/```json\n?|```\n?/g, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // Response may contain text before/after the JSON — try to extract it
    const match = cleaned.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new ReceiptExtractorError(
        "No JSON found in response",
        "PARSE_ERROR"
      );
    }

    try {
      return JSON.parse(match[0]);
    } catch {
      throw new ReceiptExtractorError(
        "Failed to parse JSON from response",
        "PARSE_ERROR"
      );
    }
  }
}
