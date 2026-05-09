
import { deriveWalletFromMnemonic,decryptMnemonic} from "../pqsdk/lib/mnemonic"
import { getDB } from "./getdb";



/**
 * Recovers a Solana wallet from an existing BIP-39 mnemonic phrase.
 *
 * @param {string} phrase - The BIP-39 mnemonic recovery phrase.
 *
 * @returns {Promise<{ pubkey: string, mnemonic: string, secretKey: string }>}
 * @throws {WalletCreationError}
 */
export async function RecoverSolana(password) {



  // Input validation
  if(password ==""){
    throw Error("password should not be empty")
  }

   let storedphrase=await db.get('keyval', "wallet");
   let decrypted_storedphrase=decryptMnemonic(storedphrase,password)
   
  // Input validation 


  if (!decrypted_storedphrase || typeof decrypted_storedphrase !== "string" || decrypted_storedphrase.trim().length === 0) {
    throw new WalletCreationError("A non-empty recovery phrase is required.");
  }

  if (!bip39.validateMnemonic(decrypted_storedphrase.trim())) {
    throw new WalletCreationError("Invalid mnemonic phrase. Please check your words and try again.");
  }

  // Derive wallet from phrase
  let wallet;
  try {
    wallet = await deriveWalletFromMnemonic(decrypted_storedphrase);
  } catch (err) {
    throw new WalletCreationError("Failed to derive wallet from recovery phrase.", err);
  }

  // Return recovered wallet info
  return {
    pubkey:    wallet.publicKey.toBase58(),
    mnemonic:  decrypted_storedphrase
  };
}