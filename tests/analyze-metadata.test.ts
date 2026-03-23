import { describe, it, expect, vi } from "vitest";
import { analyzeMetadata, formatMetadataForPrompt } from "../src/analyze-metadata";

vi.mock("exifr", () => ({
  default: {
    parse: vi.fn(),
  },
}));

import exifr from "exifr";

describe("analyzeMetadata", () => {
  it("flags missing EXIF data", async () => {
    vi.mocked(exifr.parse).mockResolvedValue(null);

    const result = await analyzeMetadata(Buffer.from("fake-image"));

    expect(result.hasExif).toBe(false);
    expect(result.hasGps).toBe(false);
    expect(result.flags).toHaveLength(1);
    expect(result.flags[0].code).toBe("no_exif");
    expect(result.flags[0].type).toBe("suspicious");
  });

  it("flags when exifr throws (no parseable segments)", async () => {
    vi.mocked(exifr.parse).mockRejectedValue(new Error("No EXIF"));

    const result = await analyzeMetadata(Buffer.from("fake-image"));

    expect(result.hasExif).toBe(false);
    expect(result.flags[0].code).toBe("no_exif");
  });

  it("detects AI generation software", async () => {
    vi.mocked(exifr.parse).mockResolvedValue({
      Software: "DALL-E 3",
    });

    const result = await analyzeMetadata(Buffer.from("fake-image"));

    expect(result.hasExif).toBe(true);
    expect(result.software).toBe("DALL-E 3");
    const aiFlag = result.flags.find((f) => f.code === "ai_software");
    expect(aiFlag).toBeDefined();
    expect(aiFlag!.type).toBe("suspicious");
    expect(aiFlag!.description).toContain("DALL-E 3");
  });

  it("detects editing software", async () => {
    vi.mocked(exifr.parse).mockResolvedValue({
      Software: "Adobe Photoshop CC 2024",
    });

    const result = await analyzeMetadata(Buffer.from("fake-image"));

    const editFlag = result.flags.find((f) => f.code === "editing_software");
    expect(editFlag).toBeDefined();
    expect(editFlag!.type).toBe("suspicious");
    expect(editFlag!.description).toContain("Adobe Photoshop CC 2024");
  });

  it("detects editing software from CreatorTool field", async () => {
    vi.mocked(exifr.parse).mockResolvedValue({
      CreatorTool: "GIMP 2.10",
    });

    const result = await analyzeMetadata(Buffer.from("fake-image"));

    const editFlag = result.flags.find((f) => f.code === "editing_software");
    expect(editFlag).toBeDefined();
    expect(editFlag!.description).toContain("GIMP 2.10");
  });

  it("detects XMP edit history", async () => {
    vi.mocked(exifr.parse).mockResolvedValue({
      History: [{ action: "saved" }],
      Make: "Apple",
      Model: "iPhone 15 Pro",
    });

    const result = await analyzeMetadata(Buffer.from("fake-image"));

    const historyFlag = result.flags.find((f) => f.code === "edit_history");
    expect(historyFlag).toBeDefined();
    expect(historyFlag!.type).toBe("suspicious");
  });

  it("detects mismatched document IDs", async () => {
    vi.mocked(exifr.parse).mockResolvedValue({
      DocumentID: "xmp.did:abc123",
      OriginalDocumentID: "xmp.did:different456",
      Make: "Samsung",
      Model: "Galaxy S24",
    });

    const result = await analyzeMetadata(Buffer.from("fake-image"));

    const historyFlag = result.flags.find((f) => f.code === "edit_history");
    expect(historyFlag).toBeDefined();
  });

  it("recognizes real camera info as positive signal", async () => {
    vi.mocked(exifr.parse).mockResolvedValue({
      Make: "Apple",
      Model: "iPhone 15 Pro",
      DateTimeOriginal: new Date("2024-12-15T14:30:00Z"),
      latitude: 14.5995,
      longitude: 120.9842,
    });

    const result = await analyzeMetadata(Buffer.from("fake-image"));

    expect(result.hasExif).toBe(true);
    expect(result.cameraMake).toBe("Apple");
    expect(result.cameraModel).toBe("iPhone 15 Pro");
    expect(result.hasGps).toBe(true);
    expect(result.dateTime).toBe("2024-12-15T14:30:00.000Z");

    const cameraFlag = result.flags.find((f) => f.code === "has_camera_info");
    expect(cameraFlag).toBeDefined();
    expect(cameraFlag!.type).toBe("positive");

    const gpsFlag = result.flags.find((f) => f.code === "has_gps");
    expect(gpsFlag).toBeDefined();
    expect(gpsFlag!.type).toBe("positive");

    const dateFlag = result.flags.find((f) => f.code === "has_datetime");
    expect(dateFlag).toBeDefined();
    expect(dateFlag!.type).toBe("positive");
  });

  it("flags missing camera info when EXIF exists but no Make/Model", async () => {
    vi.mocked(exifr.parse).mockResolvedValue({
      Software: "some app",
    });

    const result = await analyzeMetadata(Buffer.from("fake-image"));

    const noCameraFlag = result.flags.find((f) => f.code === "no_camera_info");
    expect(noCameraFlag).toBeDefined();
    expect(noCameraFlag!.type).toBe("suspicious");
  });

  it("handles string datetime values", async () => {
    vi.mocked(exifr.parse).mockResolvedValue({
      CreateDate: "2024:12:15 14:30:00",
      Make: "Google",
      Model: "Pixel 8",
    });

    const result = await analyzeMetadata(Buffer.from("fake-image"));

    expect(result.dateTime).toBe("2024:12:15 14:30:00");
  });
});

describe("formatMetadataForPrompt", () => {
  it("formats no-EXIF case", () => {
    const prompt = formatMetadataForPrompt({
      hasExif: false,
      flags: [
        { type: "suspicious", code: "no_exif", description: "No EXIF metadata found." },
      ],
      hasGps: false,
    });

    expect(prompt).toContain("No EXIF metadata");
  });

  it("formats multiple flags with prefixes", () => {
    const prompt = formatMetadataForPrompt({
      hasExif: true,
      flags: [
        { type: "suspicious", code: "editing_software", description: "Edited in Photoshop" },
        { type: "positive", code: "has_camera_info", description: "Camera: Apple iPhone 15" },
      ],
      software: "Photoshop",
      hasGps: false,
    });

    expect(prompt).toContain("METADATA ANALYSIS");
    expect(prompt).toContain("⚠ Edited in Photoshop");
    expect(prompt).toContain("✓ Camera: Apple iPhone 15");
  });
});
