
/**
 * 
 * open source under MIT
 */



import { Keypair } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { QualtumClient } from "./Client/qualtum.js"; 
import idl from "./Client/idl.json";
import crypto from "crypto";
import fs from "fs";

import { 
    generateCDPair, 
    signViaCD 
} from "./Algorithm/crystals_dilithium.js"

const KEYSTORE_PATH = "./qualtum_keys.json";

// Persistence

const saveKeys = (data) => {

    // Convert Uint8Arrays to Hex for JSON storage
    const storage = {
        solanaSecret: Buffer.from(data.solanaSecret).toString("hex"),
        pqSecretKey: Buffer.from(data.sk).toString("hex"),
        lastSignature: Buffer.from(data.signature).toString("hex"),
    };
    fs.writeFileSync(KEYSTORE_PATH, JSON.stringify(storage, null, 2));
    console.log(`[Vault] Persistence: Keys secured to ${KEYSTORE_PATH}`);
};

const hash = (buffer) => {
    const hash1 = crypto.createHash("sha256").update(buffer).digest();
    return crypto.createHash("sha256").update(hash1).digest();
};

async function Qualtum(message) {

    const client = new QualtumClient("AEJgjbJf4GW67izumzv7hQotMQMihBaedyNQ9U898zG7", idl);
    
    try {
        // 1. Check if keys already exist to simulate a returning user
        let pk, sk, solanaKeypair, wallet;

        if (fs.existsSync(KEYSTORE_PATH)) {
            console.log("[Vault] Existing session found. Loading PQ keys...");
            const saved = JSON.parse(fs.readFileSync(KEYSTORE_PATH));
       
            solanaKeypair = Keypair.fromSecretKey(Buffer.from(saved.solanaSecret, "hex"));
        } else {
            console.log("[Vault] No session found. Generating new PQ identity...");
            const keys = generateCDPair();
            pk = keys.pk;
            sk = keys.sk;
            solanaKeypair = Keypair.generate();
        }

        wallet = new anchor.Wallet(solanaKeypair);

       
        const message = solanaKeypair.publicKey.toBuffer();
        const signature = signViaCD(message, sk);

        // 3. Save everything immediately after generation
        savePQKeys({ solanaSecret: solanaKeypair.secretKey, pk, sk, signature });

        // 4. Commitment Logic
        const commitmentHex = getDoubleSha256(signature).toString("hex");

    
        console.log("Initializing  Vault for:", wallet.publicKey.toBase58());
        
       
        await client.initVault(wallet, commitmentHex);
        await client.deposit(wallet, 0.01);
        
        console.log("[Qualtum] Testing withdrawal with stored signature...");
        const signatureHex = Buffer.from(signature).toString("hex");
        await client.withdraw(wallet, 0.005, signatureHex);

        console.log("Your Qualtum session is persistent. You can now close the script.");

    } catch (err) {
        console.error("Error:", err.message);
    }
}


Qualtum("msghere");