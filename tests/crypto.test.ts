import { describe, expect, it } from "vitest";

describe("AES-256-GCM", () => {
  it("round-trips and rejects tampering", async () => {
    process.env.ENCRYPTION_KEY = "test-key";
    const { encrypt, decrypt } = await import("@/lib/crypto");
    const enc = encrypt("pat-eu1-secret");
    expect(enc).not.toContain("secret");
    expect(decrypt(enc)).toBe("pat-eu1-secret");
    const [iv, tag, data] = enc.split(".");
    const flipped = Buffer.from(data, "base64");
    flipped[0] ^= 1;
    expect(() => decrypt([iv, tag, flipped.toString("base64")].join("."))).toThrow();
  });
});
