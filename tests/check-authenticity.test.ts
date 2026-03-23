import { describe, it, expect, vi } from "vitest";
import { analyzeMetadata } from "../src/analyze-metadata";

vi.mock("../src/analyze-metadata", () => ({
  analyzeMetadata: vi.fn(),
  formatMetadataForPrompt: vi.fn().mockReturnValue("METADATA ANALYSIS: mocked."),
}));

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

const NO_EXIF_METADATA = {
  hasExif: false,
  flags: [{ type: "suspicious", code: "no_exif", description: "No EXIF metadata found." }],
  hasGps: false,
};

const REAL_CAMERA_METADATA = {
  hasExif: true,
  flags: [
    { type: "positive", code: "has_camera_info", description: "Camera: Apple iPhone 15 Pro" },
    { type: "positive", code: "has_gps", description: "GPS coordinates present." },
  ],
  hasGps: true,
  cameraMake: "Apple",
  cameraModel: "iPhone 15 Pro",
};

const EDITING_SOFTWARE_METADATA = {
  hasExif: true,
  flags: [
    { type: "suspicious", code: "editing_software", description: "Edited in Photoshop" },
    { type: "suspicious", code: "no_camera_info", description: "No camera info." },
  ],
  hasGps: false,
};

describe("checkAuthenticity", () => {
  it("passes through result when metadata has positive signals", async () => {
    vi.mocked(analyzeMetadata).mockResolvedValue(REAL_CAMERA_METADATA as any);

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
    expect(result.metadata).toBeDefined();
    expect(result.metadata.hasExif).toBe(true);
  });

  it("reclassifies to ai_generated when no EXIF and low Claude confidence", async () => {
    vi.mocked(analyzeMetadata).mockResolvedValue(NO_EXIF_METADATA as any);

    const client = mockClient(
      JSON.stringify({
        classification: "real",
        confidence: 0.75,
        reasoning: "Looks somewhat real.",
      })
    );

    const result = await checkAuthenticity(client, Buffer.from("fake"), "image/jpeg");

    expect(result.classification).toBe("ai_generated");
    expect(result.confidence).toBe(0.5);
    expect(result.reasoning).toContain("[Adjusted");
  });

  it("caps confidence but keeps real when no EXIF and high Claude confidence", async () => {
    vi.mocked(analyzeMetadata).mockResolvedValue(NO_EXIF_METADATA as any);

    const client = mockClient(
      JSON.stringify({
        classification: "real",
        confidence: 0.95,
        reasoning: "Very convincing thermal printer artifacts.",
      })
    );

    const result = await checkAuthenticity(client, Buffer.from("fake"), "image/jpeg");

    expect(result.classification).toBe("real");
    expect(result.confidence).toBe(0.5);
    expect(result.reasoning).toContain("confidence capped");
  });

  it("reduces confidence when EXIF has only suspicious flags", async () => {
    vi.mocked(analyzeMetadata).mockResolvedValue(EDITING_SOFTWARE_METADATA as any);

    const client = mockClient(
      JSON.stringify({
        classification: "real",
        confidence: 0.9,
        reasoning: "Looks real visually.",
      })
    );

    const result = await checkAuthenticity(client, Buffer.from("fake"), "image/jpeg");

    expect(result.classification).toBe("real");
    expect(result.confidence).toBe(0.6);
    expect(result.reasoning).toContain("suspicious metadata");
  });

  it("does not adjust ai_generated or forged classifications", async () => {
    vi.mocked(analyzeMetadata).mockResolvedValue(NO_EXIF_METADATA as any);

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
    expect(result.metadata).toBeDefined();
  });

  it("handles response wrapped in code blocks", async () => {
    vi.mocked(analyzeMetadata).mockResolvedValue(NO_EXIF_METADATA as any);

    const client = mockClient(
      '```json\n{"classification":"forged","confidence":0.72,"reasoning":"Mismatched fonts detected."}\n```'
    );

    const result = await checkAuthenticity(client, Buffer.from("fake"), "image/jpeg");

    expect(result.classification).toBe("forged");
    expect(result.confidence).toBe(0.72);
  });

  it("throws on invalid JSON response", async () => {
    vi.mocked(analyzeMetadata).mockResolvedValue(NO_EXIF_METADATA as any);

    const client = mockClient("not json at all");

    await expect(
      checkAuthenticity(client, Buffer.from("fake"), "image/jpeg")
    ).rejects.toThrow();
  });
});
