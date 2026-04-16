/**
 * AES-256-GCM encryption utility.
 *
 * GCM (Galois/Counter Mode) provides both confidentiality AND integrity — any
 * tampered ciphertext will fail decryption with an auth-tag mismatch error,
 * which prevents padding-oracle style attacks that plague plain CBC mode.
 *
 * Stored format (all hex, colon-separated):  iv:authTag:ciphertext
 *
 * The encryption key is derived deterministically from EMAIL_ENCRYPTION_KEY via
 * SHA-256 so it works with any length passphrase while always producing the
 * required 32-byte key for AES-256.
 */

import * as crypto from "crypto";
import env from "../config/env";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;   // 96-bit IV — NIST recommended size for GCM
const TAG_BYTES = 16;  // 128-bit auth tag

/** Derive a stable 32-byte key from the configured passphrase. */
function getKey(): Buffer {
  const raw = env.EMAIL_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "EMAIL_ENCRYPTION_KEY is not set. Configure it in .env (local) " +
      "or as a Firebase secret (production).",
    );
  }
  return crypto.createHash("sha256").update(raw).digest();
}

/**
 * Encrypt a plain-text string.
 * Returns a hex-encoded string in the form  iv:authTag:ciphertext
 * that is safe to store in the database.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString("hex"),
    tag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

/**
 * Decrypt a value produced by `encrypt()`.
 * Throws if the key is wrong or the ciphertext has been tampered with.
 */
export function decrypt(hash: string): string {
  const parts = hash.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted value format — expected iv:tag:ciphertext");
  }

  const [ivHex, tagHex, encHex] = parts;
  const key = getKey();
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const encrypted = Buffer.from(encHex, "hex");

  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error("Malformed encrypted value");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return (
    decipher.update(encrypted).toString("utf8") +
    decipher.final("utf8")
  );
}
