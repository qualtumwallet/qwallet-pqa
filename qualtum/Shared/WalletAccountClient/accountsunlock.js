import * as bip39 from "bip39";
import { Connection, PublicKey } from "@solana/web3.js";
import base58 from "bs58";
import { ethers, Wallet } from "ethers";
import { deriveWalletFromMnemonic, encryptMnemonic, decryptMnemonic } from "./mnemonic";
import { getDB } from "./getdb";

const db = await getDB();

/**
 * Unlocks an Ethereum wallet from encrypted storage using a password.
 *
 * @param {string} password - User-supplied password to decrypt the wallet.
 * @param {string} network  - "main" or "dev"
 *
 * @returns {Promise<{ pubkey: string, balance: string }>}
 * @throws {WalletCreationError}
 */
export async function handleUnlockEth(password, network) {

  // Input validation
  if (!password || typeof password !== "string" || password.trim().length === 0) {
    throw new WalletCreationError("A non-empty password is required.");
  }

  if (!["main", "dev"].includes(network)) {
    console.warn(`[handleUnlockEth] Unknown network "${network}", defaulting to dev.`);
  }

  // Provider
  const networktype = network === "main"
    ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.APIKEY}`
    : `https://eth-sepolia.g.alchemy.com/v2/${process.env.APIKEY}`;
  const provider = new ethers.JsonRpcProvider(networktype);

  // Load and decrypt wallet
  let wallet;
  try {
    const json = await db.get('keyval', "wallet");
    if (!json) throw new Error("No wallet found in storage.");

    wallet = await ethers.Wallet.fromEncryptedJson(json, password);
  } catch (err) {
    throw new WalletCreationError("Failed to decrypt Ethereum wallet. Password may be incorrect.", err);
  }

  // Persist session key
  try {
    await db.put('keyval', base58.encode(wallet.signingKey.privateKey), "cwallet");
  } catch (err) {
    throw new WalletCreationError("Failed to persist session key.", err);
  }

  // Return wallet info
  return {
    pubkey:  wallet.address,
    balance: ethers.formatEther(await provider.getBalance(wallet.address)),
  };
}




/**
 * Unlocks a Solana wallet from encrypted storage using a password.
 *
 * @param {string} password - User-supplied password to decrypt the mnemonic.
 * @param {string} network  - "main" or "dev"
 *
 * @returns {Promise<{ pubkey: string, balance: string }>}
 * @throws {WalletCreationError}
 */
export async function handleUnlock(password, network) {

  // Input validation
  if (!password || typeof password !== "string" || password.trim().length === 0) {
    throw new WalletCreationError("A non-empty password is required.");
  }

  if (!["main", "dev"].includes(network)) {
    console.warn(`[handleUnlock] Unknown network "${network}", defaulting to dev.`);
  }

  // Load and decrypt mnemonic
  let mnemonic, wallet;
  try {
    const stored = await db.get('keyval', "wallet");
    if (!stored) throw new Error("No wallet found in storage.");

    mnemonic = await decryptMnemonic(stored, password);
    wallet = await deriveWalletFromMnemonic(mnemonic);
  } catch (err) {
    throw new WalletCreationError("Failed to decrypt Solana wallet. Password may be incorrect.", err);
  }

  // Persist session key
  try {
    await db.put('keyval', base58.encode(wallet.secretKey), "cwallet");
  } catch (err) {
    throw new WalletCreationError("Failed to persist session key.", err);
  }

  // Fetch balance
  let balanceSOL;
  try {
    const networktype = network === "main"
      ? `https://mainnet.helius-rpc.com/?${process.env.APIKEY}`
      : `https://devnet.helius-rpc.com/?${process.env.APIKEY}`;
    const connection = new Connection(networktype);
    const lamports = await connection.getBalance(wallet.publicKey);
    balanceSOL = (lamports / 1e9).toString();
  } catch (err) {
    throw new WalletCreationError("Failed to fetch Solana balance.", err);
  }

  // Return wallet info
  return {
    pubkey:  wallet.publicKey.toBase58(),
    balance: balanceSOL,
  };
}