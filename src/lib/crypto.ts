import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function key(): Buffer {
  const k = process.env.ENCRYPTION_KEY;
  if (!k) throw new Error("ENCRYPTION_KEY is not set");
  return createHash("sha256").update(k).digest();
}

export const encryptionEnabled = () => Boolean(process.env.ENCRYPTION_KEY);

/** AES-256-GCM. Output: base64(iv).base64(tag).base64(ciphertext). */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}

export function decrypt(token: string): string {
  const [iv, tag, enc] = token.split(".").map((p) => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}
