const SUPPORTED_FORMATS: Record<string, number[]> = {
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/webp": [0x52, 0x49, 0x46, 0x46],
};

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

function detectMimeType(buffer: Buffer): string | null {
  for (const [mime, signature] of Object.entries(SUPPORTED_FORMATS)) {
    if (signature.every((byte, i) => buffer[i] === byte)) {
      return mime;
    }
  }
  return null;
}

export interface ImageValidation {
  valid: boolean;
  mimeType: string | null;
  error?: string;
}

export function validateImage(buffer: Buffer): ImageValidation {
  if (!buffer || buffer.length === 0) {
    return { valid: false, mimeType: null, error: "Image buffer is empty" };
  }

  if (buffer.length > MAX_SIZE_BYTES) {
    return { valid: false, mimeType: null, error: "Image exceeds 10MB size limit" };
  }

  const mimeType = detectMimeType(buffer);

  if (!mimeType) {
    return { valid: false, mimeType: null, error: "Unsupported image format. Use JPEG, PNG, or WebP" };
  }

  return { valid: true, mimeType };
}
