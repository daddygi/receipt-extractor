import Anthropic from "@anthropic-ai/sdk";
import { analyzeImage } from "./claude-client";
import { extractJson } from "./parse-json";
import { AuthenticityResult } from "./types";

const PROMPT = `You are a forensic image analyst. Your task is to determine if this receipt image is authentic.

STEP 1: First, read and transcribe ALL text visible on the receipt, line by line. Include every word, number, and symbol.

STEP 2: Analyze the transcribed text for red flags:
- Any mention of "generated", "sample", "test", "fake", "demo", or AI tool names
- Receipt IDs or transaction numbers that look fabricated
- Nonsensical or placeholder text
- Content that seems templated or generic

STEP 3: Analyze the image visually:
- Is the text too clean/perfect for a thermal printer? Real thermal printers produce fading, uneven ink, slight misalignment
- Is the paper texture too smooth or uniform? Real receipts show curl, creases, wrinkles
- Is the lighting too perfect or studio-like? Real photos have natural ambient lighting
- Does the background look staged or rendered?
- Are there editing artifacts? (mismatched fonts, cut/paste edges, inconsistent shadows)

STEP 4: Based on ALL evidence from steps 2 and 3, classify as:
- "real": genuine photograph of a real physical receipt
- "ai_generated": image created by AI or digitally generated
- "forged": real receipt photo that has been digitally edited/manipulated

If ANY text red flags are found in step 2 (like the word "generated" appearing anywhere on the receipt), classify as "ai_generated" regardless of how realistic the image looks visually.

Respond in this exact JSON format and nothing else:
{
  "classification": "real" | "ai_generated" | "forged",
  "confidence": <number between 0 and 1>,
  "reasoning": "<cite specific text and visual evidence>"
}`;

export async function checkAuthenticity(
  client: Anthropic,
  imageBuffer: Buffer,
  mimeType: string,
  model?: string
): Promise<AuthenticityResult> {
  const response = await analyzeImage(client, imageBuffer, mimeType, PROMPT, model);

  const parsed = extractJson(response) as any;

  return {
    classification: parsed.classification,
    confidence: parsed.confidence,
    reasoning: parsed.reasoning,
  };
}
