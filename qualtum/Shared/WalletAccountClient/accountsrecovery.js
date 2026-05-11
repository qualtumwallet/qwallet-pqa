import { Wallet ,ethers}  from "ethers"
import { deriveWalletFromMnemonic} from "./mnemonic";
import {Connection} from "solana/web3.js"
import base58 from "bs58";
import { getDB } from "./getdb";





/**
 * Recovers an Ethereum wallet from a BIP-39 mnemonic phrase.
 *
 * @param {string} phrase - The BIP-39 mnemonic recovery phrase.
 *
 * @returns {Promise<{ pubkey: string, mnemonic: string, balance: string }>}
 * @throws {WalletCreationError}
 */
export async function RecoverEth(phrase) {

  // Input validation
  if (!phrase || typeof phrase !== "string" || phrase.trim().length === 0) {
    throw new WalletCreationError("A non-empty recovery phrase is required.");
  }

  // Provider
  const provider = new ethers.JsonRpcProvider("https://eth-mainnet.g.alchemy.com/v2/t_xgvA1B9LHUO58opLOUk");

  // Derive wallet from phrase
  let newWallet;
  try {
    newWallet = Wallet.fromMnemonic(phrase, "m/44'/60'/0'/0/0");

    if (!newWallet.mnemonic) {
      throw new Error("Recovered wallet has no mnemonic.");
    }
  } catch (err) {
    throw new WalletCreationError("Failed to derive Ethereum wallet from phrase.", err);
  }

  // Persist session key
  try {
    await db.put('keyval', base58.encode(newWallet.privateKey), "cwallet");
  } catch (err) {
    throw new WalletCreationError("Failed to persist session key.", err);
  }

 

  // Return recovered wallet info
  return {
    pubkey:   newWallet.address,
    mnemonic: newWallet.mnemonic.phrase,
    balance:  ethers.formatEther(await provider.getBalance(newWallet.address)),
  };
}





/**
 * Recovers a Solana wallet from a BIP-39 mnemonic phrase.
 *
 * @param {string} phrase - The BIP-39 mnemonic recovery phrase.
 *
 * @returns {Promise<{ pubkey: string, mnemonic: string, balance: string }>}
 * @throws {WalletCreationError}
 */
export async function RecoverSolana(phrase) {

  // Input validation
  if (!phrase || typeof phrase !== "string" || phrase.trim().length === 0) {
    throw new WalletCreationError("A non-empty recovery phrase is required.");
  }

  // Derive wallet from phrase
  let wallet;
  try {
    wallet = await deriveWalletFromMnemonic(phrase);
  } catch (err) {
    throw new WalletCreationError("Failed to derive Solana wallet from phrase.", err);
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
    const connection = new Connection("https://mainnet.helius-rpc.com/?api-key=4e833ada-d32c-48c5-b020-c11b2253f25b");
    const lamports = await connection.getBalance(wallet.publicKey);
    balanceSOL = (lamports / 1e9).toString();
  } catch (err) {
    throw new WalletCreationError("Failed to fetch Solana balance.", err);
  }


  // Return recovered wallet info
  return {
    pubkey:   wallet.publicKey.toBase58(),
    mnemonic: phrase,
    balance:  balanceSOL,
  };
}