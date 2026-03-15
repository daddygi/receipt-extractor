import Anthropic from "@anthropic-ai/sdk";
import { analyzeImage } from "./claude-client";
import { AuthenticityResult } from "./types";

const PROMPT = `Analyze this image and determine if it is a real photograph of a physical receipt, an AI-generated image, or a forged/edited image.

Look for:
- AI generation artifacts (unnatural text, distorted characters, inconsistent lighting)
- Editing signs (mismatched fonts, cut/paste edges, inconsistent shadows, blurred regions)
- Signs of authenticity (natural paper texture, consistent lighting, realistic wear)

Respond in this exact JSON format and nothing else:
{
  "classification": "real" | "ai_generated" | "forged",
  "confidence": <number between 0 and 1>,
  "reasoning": "<brief explanation>"
}`;

export async function checkAuthenticity(
  client: Anthropic,
  imageBuffer: Buffer,
  mimeType: string
): Promise<AuthenticityResult> {
  const response = await analyzeImage(client, imageBuffer, mimeType, PROMPT);

  const json = response.replace(/```json\n?|```\n?/g, "").trim();
  const parsed = JSON.parse(json);

  return {
    classification: parsed.classification,
    confidence: parsed.confidence,
    reasoning: parsed.reasoning,
  };
}
