import { getDB } from "./getdb";
import { deriveWalletFromMnemonic ,decryptMnemonic } from "./mnemonic";

/**
 * Unlocks an existing wallet by decrypting the stored mnemonic with the given password.
 *
 * @param {string}       password      - The password used to decrypt the stored mnemonic.
 * @param {string}       encryptedData - The encrypted mnemonic blob retrieved from storage.
 *
 * @returns {Promise<{ pubkey: string, secretKey: string, mnemonic: string }>}
 * @throws {WalletCreationError}
 */
export async function handleUnlock(password) {

  // Input validation
  if (!password || typeof password !== "string" || password.trim().length === 0) {
    throw new WalletCreationError("A non-empty password is required to unlock the wallet.");
  }

    const encryptedData=await db.get('keyval', "wallet");   
    if (!encryptedData) {
    throw new WalletCreationError("No wallet found. Please create or recover a wallet first.");
  }
   


  // Decrypt mnemonic
  let mnemonic;
  try {
    mnemonic = await decryptMnemonic(encryptedData, password);
  } catch (err) {
    // Deliberately vague to avoid leaking whether the wallet exists or the password is wrong.
    throw new WalletCreationError("Failed to unlock wallet. Check your password and try again.", err);
  }

  // Derive wallet from decrypted mnemonic
  let wallet;
  try {
    wallet = await deriveWalletFromMnemonic(mnemonic);
  } catch (err) {
    throw new WalletCreationError("Failed to derive wallet from decrypted mnemonic.", err);
  }

  // Return unlocked wallet info 
  return {
    pubkey:    wallet.publicKey.toBase58(),
    mnemonic, //one time only 
  };
}