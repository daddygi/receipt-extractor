import Anthropic from "@anthropic-ai/sdk";
import { analyzeImage } from "./claude-client";
import { extractJson } from "./parse-json";
import { analyzeMetadata, formatMetadataForPrompt } from "./analyze-metadata";
import { AuthenticityResult } from "./types";

const BASE_PROMPT = `You are a forensic image analyst. Your task is to determine if this receipt image is authentic.

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

STEP 4: Review the metadata analysis provided below. Metadata is CRITICAL forensic evidence — treat it with high weight:
- Missing EXIF data is a STRONG indicator of AI generation or digital fabrication. Real phone cameras (iPhone, Samsung, Pixel, etc.) ALWAYS embed EXIF metadata including camera make/model, date/time, and often GPS. The ONLY legitimate reasons for missing EXIF are: the image was shared through a platform that strips metadata (messaging apps, social media). However, for a receipt photo submitted directly, missing EXIF is highly suspicious.
- AI generation tools (DALL-E, Midjourney, Stable Diffusion) in the software field confirm AI origin.
- Editing software (Photoshop, GIMP) suggests the image was manipulated.
- Camera make/model and GPS data are STRONG positive signals — very difficult to fake.
- XMP edit history indicates post-capture modifications.

STEP 5: Based on ALL evidence from steps 2, 3, and 4, classify as:
- "real": genuine photograph of a real physical receipt
- "ai_generated": image created by AI or digitally generated
- "forged": real receipt photo that has been digitally edited/manipulated

CLASSIFICATION RULES (in priority order):
1. If ANY text red flags are found in step 2 (like the word "generated" appearing anywhere on the receipt), classify as "ai_generated" regardless of how realistic the image looks visually.
2. If metadata reveals AI generation software, classify as "ai_generated".
3. If metadata reveals editing software or edit history, weigh this heavily toward "forged".
4. If EXIF metadata is completely missing AND there are no camera details, you MUST lower your confidence significantly (max 0.6 for "real") and be much more skeptical of visual appearance — modern AI can produce photorealistic receipt images. When in doubt with missing metadata, lean toward "ai_generated".

Respond in this exact JSON format and nothing else:
{
  "classification": "real" | "ai_generated" | "forged",
  "confidence": <number between 0 and 1>,
  "reasoning": "<cite specific text, visual, and metadata evidence>"
}`;

export async function checkAuthenticity(
  client: Anthropic,
  imageBuffer: Buffer,
  mimeType: string,
  model?: string
): Promise<AuthenticityResult> {
  const metadata = await analyzeMetadata(imageBuffer);

  const metadataContext = formatMetadataForPrompt(metadata);
  const prompt = `${BASE_PROMPT}\n\n${metadataContext}`;

  const response = await analyzeImage(client, imageBuffer, mimeType, prompt, model);

  const parsed = extractJson(response) as any;

  let classification = parsed.classification as AuthenticityResult["classification"];
  let confidence: number = parsed.confidence;
  let reasoning: string = parsed.reasoning;

  // Local confidence adjustment based on metadata signals
  const suspiciousCount = metadata.flags.filter((f) => f.type === "suspicious").length;
  const positiveCount = metadata.flags.filter((f) => f.type === "positive").length;

  if (classification === "real" && positiveCount === 0) {
    // No positive metadata signals — cap confidence and potentially reclassify
    if (!metadata.hasExif) {
      // No EXIF at all: strong penalty
      if (confidence > 0.5) {
        confidence = 0.5;
        reasoning += " [Adjusted: confidence capped due to missing EXIF metadata with no positive signals.]";
      }
      // If Claude was barely confident, flip to ai_generated
      if (parsed.confidence < 0.8) {
        classification = "ai_generated";
        confidence = 1 - confidence;
        reasoning += " [Adjusted: reclassified as ai_generated — no EXIF metadata and insufficient visual confidence.]";
      }
    } else if (suspiciousCount > 0) {
      // Has EXIF but only suspicious flags (e.g., editing software, no camera info)
      confidence = Math.min(confidence, 0.6);
      reasoning += " [Adjusted: confidence reduced due to suspicious metadata with no positive signals.]";
    }
  }

  return {
    classification,
    confidence,
    reasoning,
    metadata,
  };
}
