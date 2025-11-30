import crypto from "crypto";

/**
 * Key Management System (KMS) - Enterprise-Grade Key Derivation
 * 
 * This module implements a secure KMS using PBKDF2 for key derivation.
 * The master secret is stored in environment variables and never logged.
 * 
 * Security Model:
 * - Master Secret: Stored securely in environment (MASTER_KMS_SECRET)
 * - Key Derivation: PBKDF2-SHA256 with unique salt per key type
 * - Key Rotation: Supported via versioning
 * 
 * Reference: https://nodejs.org/api/crypto.html#crypto_crypto_pbkdf2_password_salt_iterations_keylen_digest_callback
 */

const KMS_ITERATIONS = 100000; // NIST recommendation for PBKDF2
const KMS_KEY_LENGTH = 32; // 256-bit keys
const KMS_HASH_ALGORITHM = "sha256";

export interface KMSConfig {
  masterSecret: string;
  version: number;
  createdAt: Date;
}

export interface DerivedKey {
  key: Buffer;
  version: number;
  keyType: string;
}

// Singleton KMS instance
let kmsInstance: KMS | null = null;

export class KMS {
  private masterSecret: string;
  private version: number;
  private createdAt: Date;

  private static readonly SALT_PREFIXES: Record<string, string> = {
    privateKey: "kms:private_key:v1",
    masterWallet: "kms:master_wallet:v1",
    hmacSecret: "kms:hmac_secret:v1",
    apiKeyDerivation: "kms:api_key:v1",
    sessionEncryption: "kms:session:v1",
  };

  constructor(masterSecret: string, version: number = 1) {
    if (!masterSecret || masterSecret.length < 32) {
      throw new Error(
        "Master secret must be at least 32 bytes (use: openssl rand -hex 16)"
      );
    }

    this.masterSecret = masterSecret;
    this.version = version;
    this.createdAt = new Date();

    // Warn if master secret is too short
    if (masterSecret.length < 64) {
      console.warn(
        "⚠️  WARNING: Master KMS secret is less than 64 bytes. Consider using: openssl rand -hex 32"
      );
    }
  }

  /**
   * Initialize KMS from environment
   */
  static initialize(masterSecret?: string): KMS {
    const secret =
      masterSecret || process.env.MASTER_KMS_SECRET || process.env.SESSION_SECRET;

    if (!secret) {
      throw new Error(
        "MASTER_KMS_SECRET environment variable not set. Generate with: openssl rand -hex 32"
      );
    }

    if (kmsInstance) {
      return kmsInstance;
    }

    kmsInstance = new KMS(secret);
    console.log("✅ KMS initialized with master secret");
    return kmsInstance;
  }

  /**
   * Get singleton KMS instance
   */
  static getInstance(): KMS {
    if (!kmsInstance) {
      kmsInstance = KMS.initialize();
    }
    return kmsInstance;
  }

  /**
   * Derive a key for a specific purpose
   * @param keyType Type of key (privateKey, masterWallet, etc.)
   * @param context Additional context for derivation (e.g., tenant ID, blockchain)
   * @returns Derived key buffer
   */
  deriveKey(keyType: keyof typeof KMS.SALT_PREFIXES, context: string = ""): DerivedKey {
    const prefix = KMS.SALT_PREFIXES[keyType];
    if (!prefix) {
      throw new Error(`Unknown key type: ${keyType}`);
    }

    // Create unique salt combining prefix and context
    const salt = Buffer.from(`${prefix}:${context}`);

    // Derive key using PBKDF2
    const derivedKey = crypto.pbkdf2Sync(
      this.masterSecret,
      salt,
      KMS_ITERATIONS,
      KMS_KEY_LENGTH,
      KMS_HASH_ALGORITHM
    );

    return {
      key: derivedKey,
      version: this.version,
      keyType,
    };
  }

  /**
   * Derive key for encrypting private keys
   */
  derivePrivateKeyEncryptionKey(walletId: string): Buffer {
    return this.deriveKey("privateKey", walletId).key;
  }

  /**
   * Derive key for encrypting master wallets
   */
  deriveMasterWalletKey(blockchain: string): Buffer {
    return this.deriveKey("masterWallet", blockchain).key;
  }

  /**
   * Derive key for HMAC operations
   */
  deriveHmacKey(purpose: string): Buffer {
    return this.deriveKey("hmacSecret", purpose).key;
  }

  /**
   * Derive key for session encryption
   */
  deriveSessionEncryptionKey(tenantId: string): Buffer {
    return this.deriveKey("sessionEncryption", tenantId).key;
  }

  /**
   * Get KMS configuration (for logging/debugging - NEVER log master secret)
   */
  getConfig(): KMSConfig {
    return {
      masterSecret: "[REDACTED]",
      version: this.version,
      createdAt: this.createdAt,
    };
  }

  /**
   * Rotate KMS (creates new version)
   * Note: In production, implement re-encryption of existing keys
   */
  rotate(newMasterSecret: string): KMS {
    const newKms = new KMS(newMasterSecret, this.version + 1);
    kmsInstance = newKms;
    console.log(`✅ KMS rotated to version ${newKms.version}`);
    return newKms;
  }

  /**
   * Test KMS functionality
   */
  static test(): boolean {
    try {
      const kms = KMS.getInstance();

      // Test key derivation
      const key1 = kms.deriveKey("privateKey", "test-wallet-1");
      const key2 = kms.deriveKey("privateKey", "test-wallet-1");

      // Same context should produce same key
      if (key1.key.toString("hex") !== key2.key.toString("hex")) {
        throw new Error("KMS key derivation not deterministic");
      }

      // Different context should produce different key
      const key3 = kms.deriveKey("privateKey", "test-wallet-2");
      if (key1.key.toString("hex") === key3.key.toString("hex")) {
        throw new Error("KMS key derivation collision detected");
      }

      console.log("✅ KMS self-test passed");
      return true;
    } catch (error) {
      console.error("❌ KMS self-test failed:", error);
      return false;
    }
  }
}

// Auto-initialize KMS on module load
if (process.env.NODE_ENV !== "test") {
  try {
    KMS.initialize();
  } catch (error) {
    console.warn("⚠️  KMS initialization warning:", error);
  }
}
