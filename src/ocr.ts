import { ReceiptExtractorError } from "./errors";

const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";
const DEFAULT_OCR_MODEL = "glm-ocr";

export interface OcrOptions {
  ollamaUrl?: string;
  ocrModel?: string;
}

export async function extractTextFromImage(
  imageBuffer: Buffer,
  options: OcrOptions = {}
): Promise<string> {
  const ollamaUrl = options.ollamaUrl || process.env.OLLAMA_URL || DEFAULT_OLLAMA_URL;
  const model = options.ocrModel || DEFAULT_OCR_MODEL;
  const base64 = imageBuffer.toString("base64");

  try {
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: "Text Recognition:",
        images: [base64],
        stream: false,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new ReceiptExtractorError(
        `Ollama request failed (${response.status}): ${body}`,
        "OCR_ERROR"
      );
    }

    const data = (await response.json()) as { response: string };
    return data.response.trim();
  } catch (error) {
    if (error instanceof ReceiptExtractorError) throw error;

    throw new ReceiptExtractorError(
      "Failed to connect to Ollama. Make sure Ollama is running (ollama serve) and the GLM-OCR model is pulled (ollama pull glm-ocr).",
      "OCR_ERROR",
      error
    );
  }
}
