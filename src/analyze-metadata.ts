import exifr from "exifr";
import { MetadataAnalysis, MetadataFlag } from "./types";

const EDITING_SOFTWARE = [
  "photoshop",
  "gimp",
  "pixlr",
  "affinity",
  "lightroom",
  "capture one",
  "paint.net",
  "corel",
  "snapseed",
  "canva",
];

const AI_SOFTWARE = [
  "dall-e",
  "dalle",
  "midjourney",
  "stable diffusion",
  "comfyui",
  "automatic1111",
  "novelai",
  "firefly",
  "imagen",
  "dreamstudio",
];

export async function analyzeMetadata(
  imageBuffer: Buffer
): Promise<MetadataAnalysis> {
  const flags: MetadataFlag[] = [];

  let exifData: Record<string, any> | null = null;

  try {
    exifData = await exifr.parse(imageBuffer, {
      tiff: true,
      xmp: true,
      icc: false,
      iptc: true,
      gps: true,
      translateValues: true,
      mergeOutput: true,
    });
  } catch {
    // exifr throws when no parseable segments exist
  }

  if (!exifData) {
    flags.push({
      type: "suspicious",
      code: "no_exif",
      description:
        "No EXIF metadata found. AI-generated images and screenshots typically lack EXIF data.",
    });

    return { hasExif: false, flags, hasGps: false };
  }

  const software = (exifData.Software ?? exifData.CreatorTool ?? "") as string;
  const softwareLower = software.toLowerCase();
  const cameraMake = exifData.Make as string | undefined;
  const cameraModel = exifData.Model as string | undefined;
  const dateTime = (exifData.DateTimeOriginal ?? exifData.CreateDate) as
    | string
    | Date
    | undefined;
  const hasGps = !!(exifData.latitude && exifData.longitude);

  // Check for AI generation software
  const matchedAi = AI_SOFTWARE.find((name) => softwareLower.includes(name));
  if (matchedAi) {
    flags.push({
      type: "suspicious",
      code: "ai_software",
      description: `Software field contains AI tool: "${software}"`,
    });
  }

  // Check for editing software
  const matchedEditor = EDITING_SOFTWARE.find((name) =>
    softwareLower.includes(name)
  );
  if (matchedEditor) {
    flags.push({
      type: "suspicious",
      code: "editing_software",
      description: `Image was processed with editing software: "${software}"`,
    });
  }

  // Check for XMP edit history (strong editing indicator)
  if (exifData.History || exifData.DocumentID !== exifData.OriginalDocumentID) {
    flags.push({
      type: "suspicious",
      code: "edit_history",
      description:
        "XMP metadata contains edit history, indicating the image was modified after capture.",
    });
  }

  // No camera info is suspicious (but less so than no EXIF at all)
  if (!cameraMake && !cameraModel) {
    flags.push({
      type: "suspicious",
      code: "no_camera_info",
      description:
        "No camera make/model found. Real phone photos typically include device information.",
    });
  } else {
    flags.push({
      type: "positive",
      code: "has_camera_info",
      description: `Camera identified: ${cameraMake ?? ""} ${cameraModel ?? ""}`.trim(),
    });
  }

  // GPS is a strong positive signal
  if (hasGps) {
    flags.push({
      type: "positive",
      code: "has_gps",
      description: "GPS coordinates present, consistent with a real phone photo.",
    });
  }

  // DateTime is a positive signal
  if (dateTime) {
    flags.push({
      type: "positive",
      code: "has_datetime",
      description: `Capture date/time recorded: ${dateTime instanceof Date ? dateTime.toISOString() : dateTime}`,
    });
  }

  return {
    hasExif: true,
    flags,
    software: software || undefined,
    cameraMake,
    cameraModel,
    dateTime:
      dateTime instanceof Date ? dateTime.toISOString() : dateTime,
    hasGps,
  };
}

export function formatMetadataForPrompt(metadata: MetadataAnalysis): string {
  if (!metadata.hasExif && metadata.flags.length === 1) {
    return "METADATA ANALYSIS: No EXIF metadata found in this image. AI-generated images and screenshots typically lack EXIF data. Consider this when making your assessment.";
  }

  const lines = ["METADATA ANALYSIS (extracted from image file):"];

  for (const flag of metadata.flags) {
    const prefix = flag.type === "suspicious" ? "⚠" : "✓";
    lines.push(`${prefix} ${flag.description}`);
  }

  lines.push(
    "",
    "Consider this metadata evidence alongside your visual and text analysis."
  );

  return lines.join("\n");
}
