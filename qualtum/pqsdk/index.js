
/**
 * 
 * open source under MIT
 */


import { QualtumClient } from "./lib/qualtum";
import { QualtumClientEth } from "./lib/qualtumeth";

import idl from "./lib/idl.json"
import abi from "./lib/abi.json"

import { generateCDPair,signViaCD } from "./lib/crystals_dilithium";
import * as crypto from "crypto";
import { handleCreate } from "./lib/keypair";
import { deriveWalletFromMnemonic,decryptMnemonic } from "./lib/mnemonic";
import * as fs from "fs"
import { getSeed } from './lib/mnemonic';

import artifact from "../Ethereum/artifacts/contracts/Qualtum.sol/Qualtum.json";
const abi = artifact.abi;

/**
 * @param {Object} config 
 * @param {string} config.chain - The blockchain to use (e.g., "solana")
 * @param {string} config.op - The operation: "setup", "deposit", or "withdraw"
 * @param {Object} config.wallet - The Anchor-compatible wallet object
 * @param {string} [config.msg] - Signing message for setup
 * @param {number} [config.amount] - Amount in SOL
 
 */




/**
 * CrystalDilithium.js
 * Manages Dilithium5 post-quantum keypair generation, persistence,
 * and encrypted seed storage using a user-supplied passcode.
 * Open source under MIT
 */



//Constants

const SEED_PATH        = "./crystal.seed";
const PBKDF2_ITERATIONS = 210_000;
const SALT_LENGTH       = 16;
const IV_LENGTH         = 12;

// Custom Errors

class CrystalError extends Error {
  constructor(message, cause) {
    super(message);
    this.name  = "CrystalError";
    this.cause = cause;
  }
}

//Seed Encryption 

/**
 * Encrypts a raw seed buffer with a passcode using PBKDF2 + AES-256-GCM.
 * Same approach as encryptMnemonic  passcode never stored, only the blob is.
 *
 * @param {Buffer|Uint8Array} seed
 * @param {string}            passcode
 * @returns {Promise<string>} JSON string — safe to write directly to disk
 */
async function encryptSeed(seed, passcode) {
  const enc      = new TextEncoder();
  const salt     = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv       = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(passcode), "PBKDF2", false, ["deriveKey"]
  );

  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    seed
  );

  // Serialize to JSON so it can be written to disk as a plain text file
  return JSON.stringify({
    ciphertext: Array.from(new Uint8Array(ciphertext)),
    iv:         Array.from(iv),
    salt:       Array.from(salt),
  });
}

/**
 * Decrypts a seed blob previously written by encryptSeed().
 * AES-GCM auth tag will throw automatically on wrong passcode or tampered file.
 *
 * @param {string} blob     JSON string read from disk
 * @param {string} passcode
 * @returns {Promise<Uint8Array>} Raw seed bytes
 * @throws {CrystalError} On wrong passcode or corrupted file
 */
async function decryptSeed(blob, passcode) {
  let data;
  try {
    data = JSON.parse(blob);
  } catch {
    throw new CrystalError("Seed file is corrupted — failed to parse JSON.");
  }

  if (!data?.ciphertext || !data?.iv || !data?.salt) {
    throw new CrystalError("Seed file is malformed — missing required fields.");
  }

  const enc = new TextEncoder();

  try {
    const keyMaterial = await crypto.subtle.importKey(
      "raw", enc.encode(passcode), "PBKDF2", false, ["deriveKey"]
    );

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

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(data.iv) },
      key,
      new Uint8Array(data.ciphertext)
    );

    return new Uint8Array(decrypted);

  } catch (err) {
    // Deliberately vague
    throw new CrystalError("Failed to decrypt seed. Passcode may be incorrect or file is corrupted.", err);
  }
}

/**
 * Creates or loads a Dilithium5 post-quantum keypair.
 *
 * op="create"  generates a fresh seed, encrypts it with the passcode, writes to disk
 * op="load"   reads the encrypted seed from disk, decrypts with passcode, derives keypair
 *
 * @param {{ op: "create"|"load", passcode: string }} account_config
 * @returns {Promise<{ publickey: Uint8Array, secretkey: Uint8Array }>}
 * @throws {CrystalError}
 */
async function CrystalDilithium(account_config) {

  //Input validation
  const { op, passcode } = account_config;

  if (!op || !["create", "load"].includes(op)) {
    throw new CrystalError(`Invalid op "${op}". Must be "create" or "load".`);
  }

  if (!passcode || typeof passcode !== "string" || passcode.trim().length === 0) {
    throw new CrystalError("A non-empty passcode is required.");
  }

  //CREATE
  if (op === "create") {
    try {
      if (fs.existsSync(SEED_PATH)) {
        throw new CrystalError(
          "Seed file already exists. Use op='load' to load it, or delete it to start fresh."
        );
      }

      // Generate a fresh 32-byte seed and derive the Dilithium keypair from it
      const seed = await getSeed();
      const { publickey, secretkey } = generateCDPair(seed);

      // Encrypt the seed with the passcode before writing  raw seed never touches disk
      const encryptedBlob = await encryptSeed(seed, passcode);
      fs.writeFileSync(SEED_PATH, encryptedBlob, "utf8");

      console.info("[CrystalDilithium] Seed created and encrypted successfully.");
      return { publickey, secretkey };

    } catch (err) {
      if (err instanceof CrystalError) throw err;
      throw new CrystalError("Failed to create Crystal keypair.", err);
    }
  }

  // LOAD
  if (op === "load") {
    try {
      if (!fs.existsSync(SEED_PATH)) {
        throw new CrystalError("No seed file found. Run op='create' first.");
      }

      // Read the encrypted blob from disk and decrypt with the passcode
      const blob = fs.readFileSync(SEED_PATH, "utf8");
      const seed = await decryptSeed(blob, passcode);

      const { publickey, secretkey } = generateCDPair(seed);

      console.info("[CrystalDilithium] Seed loaded and decrypted successfully.");
      return { publickey, secretkey };

    } catch (err) {
      if (err instanceof CrystalError) throw err;
      throw new CrystalError("Failed to load Crystal keypair.", err);
    }
  }
}





/*
export async function pqSDK(config) {


  
    
    // Initialize the client
  
      switch (config.op) {
        case "setup": {
        


           let {publickey,secretkey} = await CrystalDilithium({op:"setup",passcode:config.passcode})

          
            const programId = config.programId || "";
            const rpcUrl = config.rpcUrl || "https://api.mainnet.solana.com";
            const client = new QualtumClient(programId, idl, rpcUrl);

            
            //Sign 
            let signature = SignviaCD(config.msg,secretkey);
            // Hash the signature
            let hash_1 = crypto.createHash("sha256").update(signature).digest();
            let hash_2=crypto.createHash("sha256").update(hash_1).digest("hex");


            const res = await client.initVault(config.wallet,hash_2);
            return {
                success: res.success,
                sk: res.success ? res.sk : null,
                status: res.status,
                tx: res.tx
            };
        }

        case "deposit": {
            const res = await client.deposit(config.wallet, config.amount);
            return {
                success: res.success,
                status: res.status,
                tx: res.tx
            };
        }

        case "withdraw": {
        
            let {publickey,secretkey} = await CrystalDilithium({op:"load",passcode:config.passcode})
            //Sign 
            let signature = SignviaCD(config.msg, secretkey);
            // Hash the signature
            let hash_1 = crypto.createHash("sha256").update(signature).digest("hex");

            const res = await client.withdraw(config.wallet, config.amount,hash_1);

            return {
                success: res.success,
                status: res.status,
                tx: res.tx
            };
        }

        default:
            return { success: false, status: "Invalid operation" };
    }


  
}

*/



export async function pqSDK(config) {

    const chain = config.chain || "solana";

    let client;
    if (chain === "solana") {
        const rpcUrl = config.rpcUrl || "https://api.mainnet.solana.com";
        client = new QualtumClient(config.programId, idl, rpcUrl);
    } else if (chain === "ethereum") {
        const rpcUrl = config.rpcUrl || "https://mainnet.infura.io/v3/YOUR_KEY";
        client = new QualtumClientEth(config.contractAddress, abi, rpcUrl);
    }

    switch (config.op) {
        case "setup": {
            let { publickey, secretkey } = await CrystalDilithium({ op: "create", passcode: config.passcode });

            let signature = SignviaCD(config.msg, secretkey);
            let hash_1 = crypto.createHash("sha256").update(signature).digest();
            let hash_2 = crypto.createHash("sha256").update(hash_1).digest("hex");

            const res = chain === "solana"
                ? await client.initVault(config.wallet, hash_2)
                : await client.initVault(config.signer, hash_2);

            return {
                success: res.success,
                sk: res.success ? res.sk : null,
                status: res.status,
                tx: res.tx
            };
        }

        case "deposit": {
            const res = chain === "solana"
                ? await client.deposit(config.wallet, config.amount)
                : await client.deposit(config.signer, config.amount);

            return {
                success: res.success,
                status: res.status,
                tx: res.tx
            };
        }

        case "withdraw": {
            let { publickey, secretkey } = await CrystalDilithium({ op: "load", passcode: config.passcode });
            let signature = SignviaCD(config.msg, secretkey);
            let hash_1 = crypto.createHash("sha256").update(signature).digest("hex");

            const res = chain === "solana"
                ? await client.withdraw(config.wallet, config.amount, hash_1)
                : await client.withdraw(config.wallet, config.amount, hash_1);

            return {
                success: res.success,
                status: res.status,
                tx: res.tx
            };
        }

        default:
            return { success: false, status: "Invalid operation" };
    }
}