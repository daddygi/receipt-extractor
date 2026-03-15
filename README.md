# receipt-extractor

Extract and validate receipt data from images using Claude Vision.

Takes a receipt image, verifies its authenticity (real, AI-generated, or forged), and extracts structured data — vendor, line items, prices, total, and currency.

## Install

```bash
npm install receipt-extractor
```

## Setup

You need a [Claude API key](https://console.anthropic.com/) from Anthropic.

Set it as an environment variable:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Or pass it directly in code (see below).

## Usage

```typescript
import { extractReceipt } from "receipt-extractor";
import fs from "fs";

const image = fs.readFileSync("receipt.jpg");
const result = await extractReceipt(image);

// Or pass the API key explicitly
const result = await extractReceipt(image, {
  apiKey: "sk-ant-...",
});
```

## Response

```typescript
// Authentic receipt
{
  authenticity: {
    classification: "real",  // "real" | "ai_generated" | "forged"
    confidence: 0.95,
    reasoning: "Natural paper texture, consistent lighting..."
  },
  extraction: {
    isReceipt: true,
    vendor: "Walmart",
    items: [
      { name: "Milk", price: 3.99 },
      { name: "Bread", price: 2.49 }
    ],
    total: 6.48,
    currency: "USD"
  }
}

// Fake or non-receipt image
{
  authenticity: {
    classification: "ai_generated",
    confidence: 0.88,
    reasoning: "Text shows warping artifacts..."
  },
  extraction: null
}
```

## How it works

1. **Validates the image** — checks format (JPEG, PNG, WebP) and size (max 10MB)
2. **Checks authenticity** — sends the image to Claude Vision to classify as real, AI-generated, or forged
3. **Extracts data** — if authentic, extracts vendor, items, prices, total, and currency

If the image fails authenticity or isn't a receipt, `extraction` is `null`. No wasted API calls — extraction only runs on authentic receipts.

## Error handling

```typescript
import { extractReceipt, ReceiptExtractorError } from "receipt-extractor";

try {
  const result = await extractReceipt(image);
} catch (error) {
  if (error instanceof ReceiptExtractorError) {
    console.error(error.code); // "INVALID_IMAGE" | "MISSING_API_KEY" | "API_ERROR" | "PARSE_ERROR"
    console.error(error.message);
  }
}
```

## Types

All types are exported for use in your project:

```typescript
import type {
  ReceiptResult,
  AuthenticityResult,
  AuthenticityClassification,
  ExtractionResult,
  ReceiptItem,
  ExtractorOptions,
} from "receipt-extractor";
```

## Supported formats

- JPEG
- PNG
- WebP
- Max file size: 10MB

## License

MIT
