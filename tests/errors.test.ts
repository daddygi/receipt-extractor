import { describe, it, expect, vi } from "vitest";
import { ReceiptExtractorError } from "../src/errors";
import { createClient } from "../src/claude-client";
import { checkAuthenticity } from "../src/check-authenticity";
import { extractReceiptData } from "../src/extract-receipt";

function mockClient(response: string) {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: response }],
      }),
    },
  } as any;
}

function mockClientThatThrows(error: Error) {
  return {
    messages: {
      create: vi.fn().mockRejectedValue(error),
    },
  } as any;
}

describe("error handling", () => {
  describe("createClient", () => {
    it("throws MISSING_API_KEY when no key provided", () => {
      const original = process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;

      try {
        expect(() => createClient()).toThrow(ReceiptExtractorError);
        expect(() => createClient()).toThrow("Missing API key");
      } finally {
        if (original) process.env.ANTHROPIC_API_KEY = original;
      }
    });
  });

  describe("checkAuthenticity", () => {
    it("throws PARSE_ERROR on malformed JSON", async () => {
      const client = mockClient("not valid json");

      await expect(
        checkAuthenticity(client, Buffer.from("img"), "image/jpeg")
      ).rejects.toThrow(ReceiptExtractorError);
    });
  });

  describe("extractReceiptData", () => {
    it("throws PARSE_ERROR on malformed JSON", async () => {
      const client = mockClient("not valid json");

      await expect(
        extractReceiptData(client, Buffer.from("img"), "image/jpeg")
      ).rejects.toThrow(ReceiptExtractorError);
    });
  });

  describe("analyzeImage", () => {
    it("wraps API errors in ReceiptExtractorError", async () => {
      const { analyzeImage } = await import("../src/claude-client");
      const client = mockClientThatThrows(new Error("network failure"));

      await expect(
        analyzeImage(client, Buffer.from("img"), "image/jpeg", "test")
      ).rejects.toThrow(ReceiptExtractorError);
    });
  });

  describe("ReceiptExtractorError", () => {
    it("has name, code, and cause", () => {
      const cause = new Error("original");
      const err = new ReceiptExtractorError("msg", "TEST_CODE", cause);

      expect(err.name).toBe("ReceiptExtractorError");
      expect(err.code).toBe("TEST_CODE");
      expect(err.cause).toBe(cause);
      expect(err.message).toBe("msg");
    });
  });
});
