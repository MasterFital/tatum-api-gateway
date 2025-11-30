import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_SIZE = 32; // 256 bits
const IV_SIZE = 16; // 128 bits for GCM
const AUTH_TAG_SIZE = 16; // GCM authentication tag

/**
 * Encryption Module - AES-256-GCM
 * 
 * Provides secure encryption/decryption of private keys and sensitive data
 * Uses Galois/Counter Mode (GCM) for authenticated encryption
 * 
 * Reference: https://nodejs.org/api/crypto.html#crypto_crypto_createcipheriv_algorithm_key_iv_options
 */

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  authTag: string;
  algorithm: string;
}

/**
 * Derive encryption key from master key and data type
 * Ensures different data types use different keys
 */
export function deriveKeyForData(masterKey: Buffer, dataType: string): Buffer {
  const hmac = crypto.createHmac("sha256", masterKey);
  hmac.update(dataType);
  return hmac.digest();
}

/**
 * Encrypt data with AES-256-GCM
 * @param plaintext Data to encrypt
 * @param encryptionKey 32-byte encryption key
 * @param associatedData Additional authenticated data (optional)
 * @returns Encrypted data with IV and auth tag
 */
export function encrypt(
  plaintext: string,
  encryptionKey: Buffer,
  associatedData?: string
): EncryptedData {
  if (encryptionKey.length !== KEY_SIZE) {
    throw new Error(`Encryption key must be ${KEY_SIZE} bytes`);
  }

  const iv = crypto.randomBytes(IV_SIZE);
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey, iv);

  if (associatedData) {
    cipher.setAAD(Buffer.from(associatedData));
  }

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString("hex"),
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
    algorithm: ALGORITHM,
  };
}

/**
 * Decrypt data with AES-256-GCM
 * @param encryptedData Encrypted data with IV and auth tag
 * @param encryptionKey 32-byte encryption key
 * @param associatedData Additional authenticated data (must match encryption)
 * @returns Decrypted plaintext
 */
export function decrypt(
  encryptedData: EncryptedData,
  encryptionKey: Buffer,
  associatedData?: string
): string {
  if (encryptionKey.length !== KEY_SIZE) {
    throw new Error(`Encryption key must be ${KEY_SIZE} bytes`);
  }

  if (encryptedData.algorithm !== ALGORITHM) {
    throw new Error(`Unsupported algorithm: ${encryptedData.algorithm}`);
  }

  const iv = Buffer.from(encryptedData.iv, "hex");
  const ciphertext = Buffer.from(encryptedData.ciphertext, "hex");
  const authTag = Buffer.from(encryptedData.authTag, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey, iv);

  if (associatedData) {
    decipher.setAAD(Buffer.from(associatedData));
  }

  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch (error) {
    throw new Error("Decryption failed - data may be corrupted or tampered with");
  }
}

/**
 * Hash sensitive data for audit trails
 * Uses HMAC-SHA256 for consistency with API key hashing
 */
export function hashSensitiveData(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Securely compare two values (timing-safe)
 * Prevents timing attacks
 */
export function secureCompare(a: string, b: string): boolean {
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

/**
 * Generate secure random bytes
 */
export function generateRandomBytes(size: number): Buffer {
  return crypto.randomBytes(size);
}

/**
 * Generate random hex string
 */
export function generateRandomHex(size: number): string {
  return crypto.randomBytes(size).toString("hex");
}
