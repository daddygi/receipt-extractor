import Anthropic from "@anthropic-ai/sdk";
import { ReceiptExtractorError } from "./errors";
import { TokenUsage } from "./types";

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

const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const RETRYABLE_STATUS_CODES = [429, 500, 529];
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 5000;

export interface AnalyzeImageResponse {
  text: string;
  usage: TokenUsage;
}

export async function analyzeImage(
  client: Anthropic,
  imageBuffer: Buffer,
  mimeType: string,
  prompt: string,
  model?: string
): Promise<AnalyzeImageResponse> {
  const request = () =>
    client.messages.create({
      model: model || DEFAULT_MODEL,
      max_tokens: 2048,
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

  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await request();

      const block = response.content[0];

      if (block.type !== "text") {
        throw new ReceiptExtractorError(
          "Unexpected response format from Claude API",
          "UNEXPECTED_RESPONSE"
        );
      }

      return {
        text: block.text,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
      };
    } catch (error) {
      if (error instanceof ReceiptExtractorError) throw error;

      lastError = error;
      const status = (error as any)?.status;

      if (attempt < MAX_RETRIES && RETRYABLE_STATUS_CODES.includes(status)) {
        const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      const statusMsg = status ? ` (${status})` : "";
      const apiMessage = (error as any)?.message || "";
      throw new ReceiptExtractorError(
        `Claude API request failed${statusMsg}: ${apiMessage}`,
        "API_ERROR",
        error
      );
    }
  }

  throw new ReceiptExtractorError(
    "Claude API request failed after retries",
    "API_ERROR",
    lastError
  );
}
