import { describe, it, expect, vi } from "vitest";
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

describe("extractReceiptData", () => {
  it("extracts data from a receipt", async () => {
    const client = mockClient(
      JSON.stringify({
        isReceipt: true,
        vendor: "Walmart",
        items: [
          { name: "Milk", price: 3.99 },
          { name: "Bread", price: 2.49 },
        ],
        total: 6.48,
        currency: "USD",
      })
    );

    const result = await extractReceiptData(client, Buffer.from("fake"), "image/jpeg");

    expect(result.isReceipt).toBe(true);
    expect(result.vendor).toBe("Walmart");
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toEqual({ name: "Milk", price: 3.99 });
    expect(result.total).toBe(6.48);
    expect(result.currency).toBe("USD");
  });

  it("returns isReceipt false for non-receipt images", async () => {
    const client = mockClient(
      JSON.stringify({
        isReceipt: false,
        vendor: "",
        items: [],
        total: 0,
        currency: "",
      })
    );

    const result = await extractReceiptData(client, Buffer.from("fake"), "image/png");

    expect(result.isReceipt).toBe(false);
    expect(result.items).toHaveLength(0);
  });

  it("handles response wrapped in code blocks", async () => {
    const client = mockClient(
      '```json\n{"isReceipt":true,"vendor":"7-Eleven","items":[{"name":"Coffee","price":1.5}],"total":1.5,"currency":"PHP"}\n```'
    );

    const result = await extractReceiptData(client, Buffer.from("fake"), "image/jpeg");

    expect(result.isReceipt).toBe(true);
    expect(result.vendor).toBe("7-Eleven");
    expect(result.currency).toBe("PHP");
  });

  it("throws on invalid JSON response", async () => {
    const client = mockClient("this is not json");

    await expect(
      extractReceiptData(client, Buffer.from("fake"), "image/jpeg")
    ).rejects.toThrow();
  });
});
