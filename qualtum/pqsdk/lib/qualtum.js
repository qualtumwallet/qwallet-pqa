import * as anchor from "@coral-xyz/anchor";
import { 
    Connection, 
    PublicKey, 
    SystemProgram, 
    LAMPORTS_PER_SOL 
} from "@solana/web3.js";

import idl from "./idl.json";







export class QualtumClient {
    constructor(programId, idl, rpcUrl = "https://api.mainnet.solana.com") {
        this.programId = new PublicKey(programId);
        this.connection = new Connection(rpcUrl, "confirmed");
        this.idl = idl;
    }

    /**
     * Initializes the provider with a user's wallet.
     */
    getProgram(wallet) {
        const provider = new anchor.AnchorProvider(
            this.connection, 
            wallet, 
            anchor.AnchorProvider.defaultOptions()
        );
        return new anchor.Program(this.idl, provider);
    }

    /**
     * Derives the PDA for the vault based on the user's public key.
     */
    getVaultPda(userPublicKey) {
        const [pda] = PublicKey.findProgramAddressSync(
            [Buffer.from("pqvault"), userPublicKey.toBuffer()],
            this.programId
        );
        return pda;
    }

    /**
     * Creates a new vault with a post-quantum commitment.
     */

    async initVault(wallet, commitmentHex) {

        const program = this.getProgram(wallet);
        const vaultPda = this.getVaultPda(wallet.publicKey);
        const commitment = Array.from(Buffer.from(commitmentHex, "hex"));


        try {
            const tx = await program.methods
                .initVault(commitment)
                .accounts({
                    vault: vaultPda,
                    user: wallet.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();
            
            return { success: true, tx, vaultPda };
        } catch (err) {
            this._handleError(err);
        }
    }

    /**
     * Deposits SOL into the vault.
     */
    async deposit(wallet, amountSol) {
        const program = this.getProgram(wallet);
        const vaultPda = this.getVaultPda(wallet.publicKey);
        const amount = new anchor.BN(amountSol * LAMPORTS_PER_SOL);

        try {
            const tx = await program.methods
                .deposit(amount)
                .accounts({
                    vault: vaultPda,
                    user: wallet.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            return { success: true, tx };
        } catch (err) {
            this._handleError(err);
        }
    }

    /**
     * Withdraws SOL by providing the secret that hashes to the commitment.
     */
    async withdraw(wallet, amountSol, secretHex) {
        const program = this.getProgram(wallet);
        const vaultPda = this.getVaultPda(wallet.publicKey);
        const secret = Array.from(Buffer.from(secretHex, "hex"));
        const amount = new anchor.BN(amountSol * LAMPORTS_PER_SOL);

        try {
            const tx = await program.methods
                .withdraw(amount, secret)
                .accounts({
                    vault: vaultPda,
                    owner: wallet.publicKey,      //owner
                    userWallet: wallet.publicKey, // Recipient
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            return { success: true, tx };
        } catch (err) {
            this._handleError(err);
        }
    }

    /**
     * Internal error mapping for cleaner debugging.
     */
    _handleError(err) {
        const message = err.logs ? `Program Logs: ${err.logs.join("\n")}` : err.message;
        console.error("PQVault Error:", message);
        throw new Error(err.message);
    }
}