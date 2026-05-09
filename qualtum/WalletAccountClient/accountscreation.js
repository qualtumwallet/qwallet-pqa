import { Keypair } from "@solana/web3.js";
import * as bip39 from "bip39";

import { deriveWalletFromMnemonic, encryptMnemonic, decryptMnemonic } from "../lib/mnemonic";

import { getDB } from "./getdb";




const db=await getDB()
// Custom Errors 

class WalletCreationError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "WalletCreationError";
    this.cause = cause;
  }
}


/**
 * Creates a brand-new Solana wallet, persists the encrypted mnemonic and
 * ephemeral session key to storage, and returns the public key + mnemonic.
 *
 * @param {string}   password - User-supplied password used to encrypt the mnemonic.
 *
 * @returns {Promise<{ pubkey: string, mnemonic: string }>}
 * @throws {WalletCreationError}
 */

export async function handleCreate(password) {

  // Input validation
  if (!password || typeof password !== "string" || password.trim().length === 0) {
    throw new WalletCreationError("A non-empty password is required to create a wallet.");
  }

  if (!["main", "dev"].includes(network)) {
    console.warn(`[handleCreate] Unknown network "${network}", defaulting to devnet.`);
  }

  // Generate & encrypt mnemonic
  let mnemonic, encrypted;
  try {
    mnemonic = bip39.generateMnemonic();

    if (!bip39.validateMnemonic(mnemonic)) {
      throw new Error("Generated mnemonic failed BIP-39 validation.");
    }

    encrypted = await encryptMnemonic(mnemonic, password);
    await db.put('keyval', encrypted, "wallet")
  } catch (err) {
    throw new WalletCreationError("Failed to generate or encrypt mnemonic.", err);
  }

  // Derive Solana wallet from mnemonic
  let wallet;
  try {
    wallet = await deriveWalletFromMnemonic(mnemonic);
  } catch (err) {
    throw new WalletCreationError("Failed to derive wallet from mnemonic.", err);
  }

 
  // Return wallet information
  return {
    pubkey:   wallet.publicKey.toBase58(),
    mnemonic: mnemonic,  //Shown to user temporarily
  
  };
}