import { describe, it, expect } from "vitest";
import { validateImage } from "../src/validate-image";

describe("validateImage", () => {
  it("accepts a valid JPEG", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
    const result = validateImage(jpeg);
    expect(result.valid).toBe(true);
    expect(result.mimeType).toBe("image/jpeg");
  });

  it("accepts a valid PNG", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d]);
    const result = validateImage(png);
    expect(result.valid).toBe(true);
    expect(result.mimeType).toBe("image/png");
  });

  it("accepts a valid WebP", () => {
    const webp = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00]);
    const result = validateImage(webp);
    expect(result.valid).toBe(true);
    expect(result.mimeType).toBe("image/webp");
  });

  it("rejects an empty buffer", () => {
    const result = validateImage(Buffer.alloc(0));
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Image buffer is empty");
  });

  it("rejects an unsupported format", () => {
    const gif = Buffer.from([0x47, 0x49, 0x46, 0x38]);
    const result = validateImage(gif);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Unsupported image format. Use JPEG, PNG, or WebP");
  });

  it("rejects an image exceeding 10MB", () => {
    const large = Buffer.alloc(10 * 1024 * 1024 + 1);
    large[0] = 0xff;
    large[1] = 0xd8;
    large[2] = 0xff;
    const result = validateImage(large);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Image exceeds 10MB size limit");
  });
});
