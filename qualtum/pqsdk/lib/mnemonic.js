
/**
 * 
 * open source under MIT
 */



import { generateMnemonic, mnemonicToSeedSync } from "bip39";
import * as bip39 from "bip39";
import * as crypto from "crypto";

export async function getSeed()  {
    
try {

    const mnemonic = generateMnemonic();
    const seed32 = mnemonicToSeedSync(mnemonic).slice(0, 32);
    return seed32

} catch(e) {
 
    throw Error("Error in mnemonic ")
}


}



export async function deriveWalletFromMnemonic(mnemonic ) {



    const seed = await bip39.mnemonicToSeed(mnemonic);
    const path = "m/44'/501'/0'/0'"; // Solana standard
    const derivedSeed = derivePath(
        path,
        seed.toString("hex")
        ).key;
    return Keypair.fromSeed(derivedSeed);


}


export async function encryptMnemonic(mnemonic,password) {


  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );


  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(mnemonic)
  );

  return {
    ciphertext: Array.from(new Uint8Array(ciphertext)),
    iv: Array.from(iv),
    salt: Array.from(salt),
  };
}



export async function decryptMnemonic(data,password) {
    
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new Uint8Array(data.salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: new Uint8Array(data.iv),
    },
    key,
    new Uint8Array(data.ciphertext)
  );

  return dec.decode(decrypted);
}
