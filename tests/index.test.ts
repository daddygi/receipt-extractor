import { describe, it, expect, vi } from "vitest";

vi.mock("../src/claude-client", () => ({
  createClient: vi.fn().mockReturnValue({}),
  analyzeImage: vi.fn(),
}));

vi.mock("../src/check-authenticity", () => ({
  checkAuthenticity: vi.fn(),
}));

vi.mock("../src/extract-receipt", () => ({
  extractReceiptData: vi.fn(),
}));

import { extractReceipt } from "../src/index";
import { checkAuthenticity } from "../src/check-authenticity";
import { extractReceiptData } from "../src/extract-receipt";

const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);

describe("extractReceipt", () => {
  it("throws on invalid image", async () => {
    await expect(extractReceipt(Buffer.alloc(0))).rejects.toThrow("Image buffer is empty");
  });

  it("returns early when image is not authentic", async () => {
    vi.mocked(checkAuthenticity).mockResolvedValue({
      classification: "ai_generated",
      confidence: 0.9,
      reasoning: "AI artifacts detected",
    });

    const result = await extractReceipt(JPEG_HEADER, { apiKey: "test-key" });

    expect(result.authenticity.classification).toBe("ai_generated");
    expect(result.extraction).toBeNull();
    expect(extractReceiptData).not.toHaveBeenCalled();
  });

  it("returns early when image is not a receipt", async () => {
    vi.mocked(checkAuthenticity).mockResolvedValue({
      classification: "real",
      confidence: 0.95,
      reasoning: "Looks real",
    });
    vi.mocked(extractReceiptData).mockResolvedValue({
      isReceipt: false,
      vendor: "",
      items: [],
      total: 0,
      currency: "",
    });

    const result = await extractReceipt(JPEG_HEADER, { apiKey: "test-key" });

    expect(result.authenticity.classification).toBe("real");
    expect(result.extraction).toBeNull();
  });

  it("returns full result for a valid authentic receipt", async () => {
    vi.mocked(checkAuthenticity).mockResolvedValue({
      classification: "real",
      confidence: 0.97,
      reasoning: "Natural photo",
    });
    vi.mocked(extractReceiptData).mockResolvedValue({
      isReceipt: true,
      vendor: "Walmart",
      items: [{ name: "Milk", price: 3.99 }],
      total: 3.99,
      currency: "USD",
    });

    const result = await extractReceipt(JPEG_HEADER, { apiKey: "test-key" });

    expect(result.authenticity.classification).toBe("real");
    expect(result.extraction).not.toBeNull();
    expect(result.extraction!.vendor).toBe("Walmart");
    expect(result.extraction!.total).toBe(3.99);
  });
});
