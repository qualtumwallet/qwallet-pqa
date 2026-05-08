import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import crypto from "crypto";
import { QualtumClient } from "../Client/qualtum.js";
import idl from "../Client/idl.json";
import { 
    generateCDPair, 
    signViaCD 
} from "../Algorithm/crystals_dilithium.js";

describe("Qualtum Protocol E2E Tests", () => {
    // Configure the provider to use the local cluster.
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const programId = new anchor.web3.PublicKey(idl.metadata.address);
    const client = new QualtumClient(programId.toBase58(), idl, provider.connection.rpcEndpoint);
    
    const user = anchor.web3.Keypair.generate();
    const wallet = new anchor.Wallet(user);

    let vaultPda;
    let dilithiumKeys;
    let signature;

    // Helper for Double SHA256
    const getDoubleSha256 = (buffer) => {
        const hash1 = crypto.createHash("sha256").update(buffer).digest();
        return crypto.createHash("sha256").update(hash1).digest();
    };

    before(async () => {
        // Airdrop SOL to the test user
        const signature = await provider.connection.requestAirdrop(
            user.publicKey,
            2 * anchor.web3.LAMPORTS_PER_SOL
        );
        await provider.connection.confirmTransaction(signature);
    });

    it("Generates Crystals-Dilithium Keys and Commits", async () => {
        // 1. Generate PQ Identity
        dilithiumKeys = generateCDPair();
        
        // 2. Sign the Solana Public Key to bind identity
        const message = user.publicKey.toBuffer();
        signature = signViaCD(message, dilithiumKeys.sk);

        // 3. Create Double-Hash Commitment
        const commitment = getDoubleSha256(signature);
        const commitmentHex = commitment.toString("hex");

        // 4. Initialize Vault
        const result = await client.initVault(wallet, commitmentHex);
        vaultPda = result.vaultPda;

        expect(result.success).to.be.true;
        
        // Verify account data
        const account = await client.getProgram(wallet).account.vaultAccount.fetch(vaultPda);
        expect(Buffer.from(account.dilithiumCommitment)).to.deep.equal(commitment);
    });

    it("Deposits SOL into the Vault", async () => {
        const amount = 1; // 1 SOL
        const result = await client.deposit(wallet, amount);
        
        expect(result.success).to.be.true;

        const balance = await provider.connection.getBalance(vaultPda);
        expect(balance).to.be.at.least(amount * anchor.web3.LAMPORTS_PER_SOL);
    });

    it("Withdraws using Post-Quantum Signature Proof", async () => {
        const amount = 0.5;
        // We provide the SINGLE hash of the signature (the pre-image of the commitment)
        const signatureHex = Buffer.from(signature).toString("hex");

        const result = await client.withdraw(wallet, amount, signatureHex);
        expect(result.success).to.be.true;
    });

    it("Fails to withdraw with an invalid signature", async () => {
        const fakeSignature = crypto.randomBytes(signature.length).toString("hex");
        
        try {
            await client.withdraw(wallet, 0.1, fakeSignature);
            expect.fail("Should have thrown an error");
        } catch (err) {
            // Check if the error message matches the IDL error for InvalidDilithiumHash
            expect(err.message).to.contain("InvalidDilithiumHash");
        }
    });
});