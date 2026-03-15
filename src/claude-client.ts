import Anthropic from "@anthropic-ai/sdk";
import { ReceiptExtractorError } from "./errors";

export function createClient(apiKey?: string): Anthropic {
  const key = apiKey || process.env.ANTHROPIC_API_KEY;

  if (!key) {
    throw new ReceiptExtractorError(
      "Missing API key. Provide it via options.apiKey or ANTHROPIC_API_KEY env var.",
      "MISSING_API_KEY"
    );
  }

  return new Anthropic({ apiKey: key });
}

export async function analyzeImage(
  client: Anthropic,
  imageBuffer: Buffer,
  mimeType: string,
  prompt: string
): Promise<string> {
  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType as "image/jpeg" | "image/png" | "image/webp",
                data: imageBuffer.toString("base64"),
              },
            },
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    });

    const block = response.content[0];

    if (block.type !== "text") {
      throw new ReceiptExtractorError(
        "Unexpected response format from Claude API",
        "UNEXPECTED_RESPONSE"
      );
    }

    return block.text;
  } catch (error) {
    if (error instanceof ReceiptExtractorError) throw error;

    throw new ReceiptExtractorError(
      "Claude API request failed",
      "API_ERROR",
      error
    );
  }
}
