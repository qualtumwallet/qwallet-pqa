import { QualtumClient } from "./lib/qualtum";
import idl from "./idl.json";
import { generateCDPair,signViaCD } from "./crystals_dilithium";
import * as crypto from "crypto";




/**
 * @param {Object} config 
 * @param {string} config.chain - The blockchain to use (e.g., "solana")
 * @param {string} config.op - The operation: "setup", "deposit", or "withdraw"
 * @param {Object} config.wallet - The Anchor-compatible wallet object
 * @param {string} [config.msg] - Signing message for setup
 * @param {number} [config.amount] - Amount in SOL
 
 */


async function CDkeypairhelper() {
    // file exists
    if (fs.existsSync(KEY_FILE_PATH)) {
        // Load and return the buffer
        console.log("Loading existing secret key from file...");
        return fs.readFileSync(KEY_FILE_PATH);
    } else {
        // Generate new pair
        console.log("No key found. Generating new CRYSTALS-Dilithium pair...");
        const { sk } = GenerateCDPair();
        
        // Buffer and save it
        const skBuffer = Buffer.from(sk);
        fs.writeFileSync(KEY_FILE_PATH, skBuffer);
        
        console.log(`New secret key saved to ${KEY_FILE_PATH}`);
        return skBuffer;
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
        

            let sk = await getOrCreateSecretKey();

            //Sign 
            let signature = SignviaCD(config.msg, sk);
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



            let sk = await getOrCreateSecretKey();
            //Sign 
            let signature = SignviaCD(config.msg, sk);
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