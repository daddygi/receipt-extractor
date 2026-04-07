import Anthropic from "@anthropic-ai/sdk";
import { analyzeImage } from "./claude-client";
import { extractJson } from "./parse-json";
import { analyzeMetadata, formatMetadataForPrompt } from "./analyze-metadata";
import { AuthenticityResult } from "./types";

function buildPrompt(): string {
  const today = new Date().toISOString().split("T")[0];

  return `You are a forensic image analyst specializing in detecting AI-generated receipt images. Your task is to determine if this receipt image is authentic.

IMPORTANT CONTEXT: Today's date is ${today}. Dates in 2026 and recent months are completely normal and expected. Do NOT flag a receipt as fake simply because of a 2026 date — that is the current year.

STEP 1: First, read and transcribe ALL text visible on the receipt, line by line. Include every word, number, and symbol. Pay very close attention to the EXACT spelling of every word.

STEP 2 (MOST IMPORTANT — this step catches most fakes): Analyze the transcribed text character by character for garbled, misspelled, or nonsensical text.

AI image generators (DALL-E, Midjourney, Stable Diffusion, Flux) are notoriously bad at generating readable text. They produce images that LOOK like real receipts at a glance but the actual text is garbled nonsense. This is the #1 way to detect AI-generated receipts. Look for:

- Item names that look like real words but are misspelled or garbled. Examples of AI-generated gibberish: "Spiltgatay" (not a real word), "Suoghotti" (trying to be "Spaghetti"), "Burdety Erreos" (trying to be "Burger"), "Ptash Pteaeno" (not real words), "Gatorea SoftIce" (garbled), "Notang TannaMilattbg" (nonsense). These are NOT OCR errors — they are AI artifacts.
- Product names that don't match real products sold at the claimed store
- Store names with subtle misspellings (e.g. "Departmenots" instead of "Departments")
- Address text that is garbled or doesn't form real addresses
- ANY text on the receipt that doesn't form coherent, real words

CRITICAL: You MUST distinguish between these two very different things:

A) POS SYSTEM CODES (LEGITIMATE — NOT fake): Real receipt printers use product codes, abbreviations, and truncated descriptions that look cryptic but are intentional. They come in many forms:
- Short all-caps codes: "CHKN MCNGT" (Chicken McNuggets), "BRG W/CHS" (Burger with Cheese), "GRN TEA LRG" (Green Tea Large)
- Consonant-heavy abbreviations with vowels removed: "CKNJOY" (Chicken Joy), "CHODRNK" (Chocolate Drink), "SMBNS" (brand code), "PRESSO" (Espresso), "MOKE" (Coke)
- Truncated product descriptions: "Fettuccine Gummi Ital" (truncated Fettuccine Gummy Italian), "CROS HAM (V)" (Croissant Ham Variant), "JRDOUGH BAGE" (Sourdough Bagel), "OLDEN RCE" (Golden Rice)
- Size/variant suffixes: "BRAZIL L (V)" (Brazil blend Large Variant), "SCSTSE GRANDE" (Starbucks Grande), "SFRIES" (Small Fries)
These codes appear alongside prices, quantities, and standard receipt formatting. They are REAL and must NOT be flagged. POS systems worldwide use wildly different abbreviation schemes, so unfamiliar codes are not automatically suspicious.

B) AI-GENERATED GARBLED TEXT (FAKE): AI image generators produce text that attempts to be full English words but contains wrong letters throughout. The words are typically LONGER than abbreviations and look like they're TRYING to spell something but fail. Examples: "Spiltgatay" (trying to be a food word but isn't), "Suoghotti" (trying to be "Spaghetti"), "Burdety Erreos" (trying to be "Burger"), "Ptash Pteaeno" (total nonsense), "Notang TannaMilattbg" (long garbled string), "Gerbottisoe Duchend" (gibberish). Notice how these are LONGER words that look like failed attempts at real English — not short intentional codes.

The test: AI-generated text tries to form COMPLETE English words but gets multiple letters wrong (e.g. "Suoghotti" trying to be "Spaghetti" — same length, multiple wrong letters). POS codes are INTENTIONALLY shortened, truncated, or abbreviated — they don't attempt to spell the full word. If text looks like a deliberate abbreviation or truncation, it is likely a real POS code. Flag text that attempts full words but fails with multiple character errors. When MOST of the receipt text is coherent but a few codes look cryptic, those codes are likely POS abbreviations. When MOST of the text is garbled or nonsensical, the receipt is AI-generated.

CRITICAL: Even if the IMAGE looks photorealistic with perfect paper texture, lighting, and thermal printer artifacts — if the TEXT contains garbled fake words (type B above), it is AI-generated. AI tools can generate realistic-looking images but CANNOT generate correct text consistently.

STEP 3: Analyze the image visually:
- Is the text too clean/perfect for a thermal printer? Real thermal printers produce fading, uneven ink, slight misalignment
- Is the paper texture too smooth or uniform? Real receipts show curl, creases, wrinkles
- Is the lighting too perfect or studio-like? Real photos have natural ambient lighting
- Does the background look staged or rendered?
- Are there editing artifacts? (mismatched fonts, cut/paste edges, inconsistent shadows)

STEP 4: Review the metadata analysis provided below:
- Missing camera make/model is common and NOT automatically suspicious (messaging apps strip this).
- Completely missing EXIF data (no fields at all) is more suspicious than partial EXIF.
- AI generation tools in the software field confirm AI origin.
- Editing software (Photoshop, GIMP) suggests manipulation.
- Camera make/model and GPS data are positive signals when present.

STEP 5: Based on ALL evidence, classify as:
- "real": genuine photograph of a real physical receipt with legible, coherent text
- "ai_generated": image created by AI (the biggest giveaway is garbled/nonsensical text)
- "forged": real receipt photo that has been digitally edited/manipulated

CLASSIFICATION RULES (in priority order):
1. If text on the receipt contains garbled/nonsensical words that are NOT real words, POS abbreviations, or OCR misreads, classify as "ai_generated". This is the strongest signal — but you MUST first rule out POS codes (Section A above) and OCR errors before applying this rule.
2. If ANY other text red flags are found (like "generated", "sample", "test", "fake", "demo"), classify as "ai_generated".
3. If metadata reveals AI generation software, classify as "ai_generated".
4. If metadata reveals editing software or edit history, weigh heavily toward "forged".
5. Classify as "real" if text on the receipt is coherent when accounting for POS abbreviations and minor OCR errors.

IMPORTANT — these alone are NOT sufficient indicators of fake receipts:
- A few POS abbreviations or truncated product codes among otherwise coherent text
- OCR misreads (dropped leading characters, letter substitutions like D/O, merged words) — cross-reference OCR text with the image before drawing conclusions
- Future dates, past dates, or expired permits/certifications — POS clocks can be misconfigured
- Corporate/franchise entity names that differ from the brand name (e.g. "SHADHILA FOOD CENTER INC." operating as Jollibee is a normal franchise arrangement)

However, if the MAJORITY of text on the receipt is garbled, misspelled, or nonsensical — even if some words are correct — classify as "ai_generated". AI generators often get some common words right (store names, "Total", "Thank you") while garbling product names and details.

Respond in this exact JSON format and nothing else:
{
  "classification": "real" | "ai_generated" | "forged",
  "confidence": <number between 0 and 1>,
  "reasoning": "<cite specific text, visual, and metadata evidence>"
}`;
}

export async function checkAuthenticity(
  client: Anthropic,
  imageBuffer: Buffer,
  mimeType: string,
  model?: string,
  ocrText?: string | null
): Promise<AuthenticityResult> {
  const metadata = await analyzeMetadata(imageBuffer);

  const metadataContext = formatMetadataForPrompt(metadata);
  const ocrContext = ocrText
    ? `\nOCR TEXT EXTRACTION (from a separate OCR model):\n---\n${ocrText}\n---\nUse this as a reference to help read text on the receipt. CAUTION: OCR models introduce their own errors — dropped leading characters, letter substitutions (e.g. 'D' misread as 'O'), and merged/split words. These are OCR artifacts, NOT evidence of AI generation. Always cross-reference against the image itself before concluding text is garbled.`
    : "";
  const prompt = `${buildPrompt()}\n\n${metadataContext}${ocrContext}`;

  const { text: response, usage } = await analyzeImage(client, imageBuffer, mimeType, prompt, model);

  const parsed = extractJson(response) as any;

  let classification = parsed.classification as AuthenticityResult["classification"];
  let confidence: number = parsed.confidence;
  let reasoning: string = parsed.reasoning;

  // Local confidence adjustment based on metadata signals
  const suspiciousCount = metadata.flags.filter((f) => f.type === "suspicious").length;
  const positiveCount = metadata.flags.filter((f) => f.type === "positive").length;

  if (classification === "real" && positiveCount === 0) {
    if (!metadata.hasExif) {
      // No EXIF at all: moderate penalty
      if (confidence > 0.6) {
        confidence = 0.6;
        reasoning += " [Adjusted: confidence capped due to completely missing EXIF metadata.]";
      }
      // Only reclassify if Claude itself was very unsure
      if (parsed.confidence < 0.6) {
        classification = "ai_generated";
        confidence = 1 - confidence;
        reasoning += " [Adjusted: reclassified as ai_generated — no EXIF metadata and low visual confidence.]";
      }
    } else if (suspiciousCount > 0) {
      // Has EXIF but suspicious flags like editing software or AI tools (not just missing camera info)
      const hasSeriousFlag = metadata.flags.some(
        (f) => f.type === "suspicious" && f.code !== "no_camera_info"
      );
      if (hasSeriousFlag) {
        confidence = Math.min(confidence, 0.65);
        reasoning += " [Adjusted: confidence reduced due to suspicious metadata flags.]";
      }
    }
  }

  return {
    classification,
    confidence,
    reasoning,
    metadata,
    usage,
  };
}
