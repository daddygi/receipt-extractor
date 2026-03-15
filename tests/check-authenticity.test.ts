import { describe, it, expect, vi } from "vitest";
import { checkAuthenticity } from "../src/check-authenticity";

function mockClient(response: string) {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: response }],
      }),
    },
  } as any;
}

describe("checkAuthenticity", () => {
  it("parses a real receipt response", async () => {
    const client = mockClient(
      JSON.stringify({
        classification: "real",
        confidence: 0.95,
        reasoning: "Natural paper texture and consistent lighting.",
      })
    );

    const result = await checkAuthenticity(client, Buffer.from("fake"), "image/jpeg");

    expect(result.classification).toBe("real");
    expect(result.confidence).toBe(0.95);
    expect(result.reasoning).toBe("Natural paper texture and consistent lighting.");
  });

  it("parses an ai_generated response", async () => {
    const client = mockClient(
      JSON.stringify({
        classification: "ai_generated",
        confidence: 0.88,
        reasoning: "Text characters show warping artifacts.",
      })
    );

    const result = await checkAuthenticity(client, Buffer.from("fake"), "image/png");

    expect(result.classification).toBe("ai_generated");
    expect(result.confidence).toBe(0.88);
  });

  it("handles response wrapped in code blocks", async () => {
    const client = mockClient(
      '```json\n{"classification":"forged","confidence":0.72,"reasoning":"Mismatched fonts detected."}\n```'
    );

    const result = await checkAuthenticity(client, Buffer.from("fake"), "image/jpeg");

    expect(result.classification).toBe("forged");
    expect(result.confidence).toBe(0.72);
  });

  it("throws on invalid JSON response", async () => {
    const client = mockClient("not json at all");

    await expect(
      checkAuthenticity(client, Buffer.from("fake"), "image/jpeg")
    ).rejects.toThrow();
  });
});
