import { describe, it, expect } from "vitest";
import { createClient } from "../src/claude-client";

describe("createClient", () => {
  it("throws when no API key is provided", () => {
    const original = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    expect(() => createClient()).toThrow("Missing API key");

    if (original) process.env.ANTHROPIC_API_KEY = original;
  });

  it("creates a client with an explicit API key", () => {
    const client = createClient("test-key");
    expect(client).toBeDefined();
  });
});
