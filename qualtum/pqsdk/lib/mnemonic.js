/**
 * mnemonic.js
 * Wallet key derivation and mnemonic encryption/decryption utilities.
 * Open source under MIT
 */

import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "bip39";
import * as bip39 from "bip39";
import { derivePath } from "ed25519-hd-key";
import { Keypair } from "@solana/web3.js";

//Constants

const SOLANA_DERIVATION_PATH = "m/44'/501'/0'/0'";
const PBKDF2_ITERATIONS      = 210_000; // OWASP 2023 recommended minimum for PBKDF2-SHA256
const SALT_LENGTH            = 16;      // bytes
const IV_LENGTH              = 12;      // bytes standard for AES-GCM

//Custom Errors

class MnemonicError extends Error {
  constructor(message, cause) {
    super(message);
    this.name  = "MnemonicError";
    this.cause = cause;
  }
}

class DerivationError extends Error {
  constructor(message, cause) {
    super(message);
    this.name  = "DerivationError";
    this.cause = cause;
  }
}

class EncryptionError extends Error {
  constructor(message, cause) {
    super(message);
    this.name  = "EncryptionError";
    this.cause = cause;
  }
}

class DecryptionError extends Error {
  constructor(message, cause) {
    super(message);
    this.name  = "DecryptionError";
    this.cause = cause;
  }
}

// Exported Functions

/**
 * Generates a fresh BIP-39 mnemonic and returns the first 32 bytes of its seed.
 * Useful when you need a raw seed for non-wallet purposes (e.g. symmetric key gen).
 *
 * NOTE: If you need a full Solana keypair, use deriveWalletFromMnemonic() instead.
 *
 * @returns {Promise<Buffer>} 32-byte seed slice
 * @throws {MnemonicError}
 */
export async function getSeed() {
  try {
    const mnemonic = generateMnemonic();

    if (!validateMnemonic(mnemonic)) {
      throw new Error("Generated mnemonic failed BIP-39 validation.");
    }

    // mnemonicToSeedSync returns 64 bytes; we slice to 32 for uses that need
    // a 256-bit key (e.g. symmetric encryption seeds).
    return mnemonicToSeedSync(mnemonic).slice(0, 32);
  } catch (err) {
    throw new MnemonicError("Failed to generate seed from mnemonic.", err);
  }
}

/**
 * Derives a Solana Keypair from a BIP-39 mnemonic using the standard
 * Solana derivation path: m/44'/501'/0'/0'
 *
 
 * so wallets derived here will match those apps for the same mnemonic.
 *
 * @param {string} mnemonic  BIP-39 mnemonic phrase (12 or 24 words)
 * @returns {Promise<Keypair>} Solana Keypair
 * @throws {MnemonicError}   If the mnemonic is invalid
 * @throws {DerivationError} If key derivation fails
 */
export async function deriveWalletFromMnemonic(mnemonic) {

  // Validate before doing any async work
  if (!mnemonic || typeof mnemonic !== "string") {
    throw new MnemonicError("Mnemonic must be a non-empty string.");
  }

  if (!validateMnemonic(mnemonic.trim())) {
    throw new MnemonicError("Invalid BIP-39 mnemonic. Check the words and try again.");
  }

  // Derive the 64-byte master seed from the mnemonic
  let seed;
  try {
    seed = await bip39.mnemonicToSeed(mnemonic.trim());
  } catch (err) {
    throw new MnemonicError("Failed to convert mnemonic to seed.", err);
  }

  // Derive the child key at the Solana path using SLIP-0010 (ed25519-hd-key)
  let derivedSeed;
  try {
    derivedSeed = derivePath(SOLANA_DERIVATION_PATH, seed.toString("hex")).key;
  } catch (err) {
    throw new DerivationError(`Failed to derive key at path ${SOLANA_DERIVATION_PATH}.`, err);
  }

  // Build and return the Solana Keypair from the 32-byte derived seed
  try {
    return Keypair.fromSeed(derivedSeed);
  } catch (err) {
    throw new DerivationError("Failed to construct Solana Keypair from derived seed.", err);
  }
}

/**
 *   Encrypts a BIP-39 mnemonic with a user-supplied password using:
 *   PBKDF2-SHA256 for key stretching (slows down brute-force attacks)
 *   AES-256-GCM for authenticated encryption (detects tampering)
 *
 * The returned object contains everything needed for decryption
 * store it as-is (e.g. in IndexedDB). Never store the raw mnemonic.
 *
 * @param {string} mnemonic  - The BIP-39 mnemonic to encrypt
 * @param {string} password  - User password (never stored anywhere)
 * @returns {Promise<{ ciphertext: number[], iv: number[], salt: number[] }>}
 * @throws {EncryptionError}
 */
export async function encryptMnemonic(mnemonic, password) {

  if (!mnemonic || !password) {
    throw new EncryptionError("Both mnemonic and password are required for encryption.");
  }

  const enc = new TextEncoder();

  try {
    // Fresh random salt and IV every time  never reuse these
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    const iv   = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    // Import the raw password bytes as a PBKDF2 key material handle
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      "PBKDF2",
      false,           // not extractable
      ["deriveKey"]
    );

    // Stretch the password into a 256-bit AES key via PBKDF2
    // High iteration count makes brute-force attacks expensive
    const key = await crypto.subtle.deriveKey(
      {
        name:       "PBKDF2",
        salt,
        iterations: PBKDF2_ITERATIONS,
        hash:       "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,           // not extractable  key 
      ["encrypt"]
    );

    // Encrypt with AES-GCM the 16-byte auth tag is appended automatically
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      enc.encode(mnemonic)
    );

    // Serialize to plain arrays so the result is JSON-serializable for storage
    return {
      ciphertext: Array.from(new Uint8Array(ciphertext)),
      iv:         Array.from(iv),
      salt:       Array.from(salt),
    };

  } catch (err) {
    throw new EncryptionError("Failed to encrypt mnemonic.", err);
  }
}

/**
 * Decrypts a mnemonic previously encrypted with encryptMnemonic().
 *
 * AES-GCM authentication will automatically throw if:
 *   - The password is wrong
 *   - The ciphertext has been tampered with
 *   - The IV or salt has been modified
 *
 * @param {{ ciphertext: number[], iv: number[], salt: number[] }} data - Output of encryptMnemonic()
 * @param {string} password - The same password used during encryption
 * @returns {Promise<string>} The original plaintext mnemonic
 * @throws {DecryptionError} On wrong password, tampered data, or malformed input
 */
export async function decryptMnemonic(data, password) {

  // ── Input validation ────────────────────────────────────────────────────────
  if (!password || typeof password !== "string") {
    throw new DecryptionError("A non-empty password is required for decryption.");
  }

  if (!data?.ciphertext || !data?.iv || !data?.salt) {
    throw new DecryptionError("Encrypted data is malformed — missing ciphertext, iv, or salt.");
  }

  const enc = new TextEncoder();
  const dec = new TextDecoder();

  try {
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );

    // Re-derive the exact same key using the stored salt and iteration count
    const key = await crypto.subtle.deriveKey(
      {
        name:       "PBKDF2",
        salt:       new Uint8Array(data.salt),
        iterations: PBKDF2_ITERATIONS,
        hash:       "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );

    // AES-GCM decrypt  throws DOMException if auth tag verification fails
    // (i.e. wrong password or tampered data intentionally indistinguishable)
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(data.iv) },
      key,
      new Uint8Array(data.ciphertext)
    );

    return dec.decode(decrypted);

  } catch (err) {
    // Don't leak whether it was a bad password vs corrupted data
    throw new DecryptionError("Decryption failed. Password may be incorrect or data is corrupted.", err);
  }
}