
/**
 * 
 * open source under MIT
 */



import { QualtumClient } from "./qualtum";
import idl from "./idl.json";
import { generateCDPair,signViaCD } from "./lib/crystals_dilithium";
import * as crypto from "crypto";
import { handleCreate } from "./lib/keypair";
import { deriveWalletFromMnemonic,decryptMnemonic } from "./lib/mnemonic";
import * as fs from "fs"

import { getSeed } from './lib/mnemonic';

SEED_PATH="./seed.txt"

/**
 * @param {Object} config 
 * @param {string} config.chain - The blockchain to use (e.g., "solana")
 * @param {string} config.op - The operation: "setup", "deposit", or "withdraw"
 * @param {Object} config.wallet - The Anchor-compatible wallet object
 * @param {string} [config.msg] - Signing message for setup
 * @param {number} [config.amount] - Amount in SOL
 
 */






async function  CrystalDilithium(accont_config) {



  if (accont_config.op=="create"){


    try {

        const seed=await getSeed()
        let {publickey,secretkey}=generateCDPair(seed)
        if (fs.existsSync(SEED_PATH)) {
            console.log("Seed File already exists");
        } else {
        fs.writeFileSync(SEED_PATH, returnedseed, "utf8");
            console.log("Seed File created");
        }
        return {publickey,secretkey}
        
    }
    catch(e){
        throw Error("Error in account generation")
    }

    }
    else if (accont_config.op=="load") {


    if (fs.existsSync(SEED_PATH)) {

        const data = fs.readFileSync(SEED_PATH, "utf8");
        console.log("Loaded data:");
        let {publickey,secretkey}=generateCDPair(data)
        return {publickey,secretkey}

    } else {
        console.log("File does not exist");
    }

    }


}

export async function pqSDK(config) {
    if (config.chain !== "solana") {
        throw new Error("Unsupported chain");
    }

    // Initialize the client
    const programId = config.programId || "";
    const rpcUrl = config.rpcUrl || "https://api.mainnet.solana.com";
    const client = new QualtumClient(programId, idl, rpcUrl);

    switch (config.op) {
        case "setup": {
        

            let {publickey,secretkey} = await CrystalDilithium({op:"setup"})
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
        
            let {publickey,secretkey} = await CrystalDilithium({op:"load"})
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