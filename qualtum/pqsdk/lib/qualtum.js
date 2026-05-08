/**
 * 
 * open source under MIT
 */

import * as anchor from "@coral-xyz/anchor";
import { 
    Connection, 
    PublicKey, 
    SystemProgram, 
    LAMPORTS_PER_SOL 
} from "@solana/web3.js";

import idl from "./idl.json";



export class QualtumError extends Error {
    constructor(message, code, context = {}) {
        super(message);
        this.name = "QualtumError";
        this.code = code;
        this.context = context;
        this.timestamp = new Date().toISOString();
    }
}

export const ErrorCode = Object.freeze({
    // Vault lifecycle
    VAULT_ALREADY_EXISTS:       "VAULT_ALREADY_EXISTS",
    VAULT_NOT_FOUND:            "VAULT_NOT_FOUND",
    VAULT_INIT_FAILED:          "VAULT_INIT_FAILED",

    // Commitment / PQ
    INVALID_COMMITMENT:         "INVALID_COMMITMENT",
    COMMITMENT_MISMATCH:        "COMMITMENT_MISMATCH",
    INVALID_SECRET:             "INVALID_SECRET",

    // Funds
    INSUFFICIENT_FUNDS:         "INSUFFICIENT_FUNDS",
    DEPOSIT_FAILED:             "DEPOSIT_FAILED",
    WITHDRAW_FAILED:            "WITHDRAW_FAILED",
    AMOUNT_TOO_SMALL:           "AMOUNT_TOO_SMALL",

    // Auth
    UNAUTHORIZED:               "UNAUTHORIZED",
    WALLET_MISMATCH:            "WALLET_MISMATCH",

    // Network / RPC
    RPC_CONNECTION_FAILED:      "RPC_CONNECTION_FAILED",
    TRANSACTION_TIMEOUT:        "TRANSACTION_TIMEOUT",
    TRANSACTION_REJECTED:       "TRANSACTION_REJECTED",
    SIMULATION_FAILED:          "SIMULATION_FAILED",

    // Input
    INVALID_PUBLIC_KEY:         "INVALID_PUBLIC_KEY",
    INVALID_HEX_INPUT:          "INVALID_HEX_INPUT",
    MISSING_ARGUMENT:           "MISSING_ARGUMENT",
});





// QualtumClient

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
        this._assertHex(commitmentHex, "commitmentHex", 64); // 32 bytes = 64 hex chars

        const program  = this.getProgram(wallet);
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
            this._handleError(err, "initVault", { wallet: wallet.publicKey.toBase58() });
        }
    }

    /**
     * Deposits SOL into the vault.
     */
    async deposit(wallet, amountSol) {
        this._assertPositiveAmount(amountSol, "amountSol");

        const program  = this.getProgram(wallet);
        const vaultPda = this.getVaultPda(wallet.publicKey);
        const amount   = new anchor.BN(amountSol * LAMPORTS_PER_SOL);

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
            this._handleError(err, "deposit", { 
                wallet: wallet.publicKey.toBase58(), 
                amountSol 
            });
        }
    }

    /**
     * Withdraws SOL by providing the secret that hashes to the commitment.
     */
    async withdraw(wallet, amountSol, secretHex) {
        this._assertPositiveAmount(amountSol, "amountSol");
        this._assertHex(secretHex, "secretHex");

        const program  = this.getProgram(wallet);
        const vaultPda = this.getVaultPda(wallet.publicKey);
        const secret   = Array.from(Buffer.from(secretHex, "hex"));
        const amount   = new anchor.BN(amountSol * LAMPORTS_PER_SOL);

        try {
            const tx = await program.methods
                .withdraw(amount, secret)
                .accounts({
                    vault: vaultPda,
                    owner: wallet.publicKey,
                    userWallet: wallet.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            return { success: true, tx };
        } catch (err) {
            this._handleError(err, "withdraw", { 
                wallet: wallet.publicKey.toBase58(), 
                amountSol 
            });
        }
    }

    //Input Guards

    _assertHex(value, argName, expectedLength = null) {
        if (!value || typeof value !== "string") {
            throw new QualtumError(
                `${argName} is required and must be a hex string.`,
                ErrorCode.MISSING_ARGUMENT,
                { argName }
            );
        }
        if (!/^[0-9a-fA-F]+$/.test(value) || value.length % 2 !== 0) {
            throw new QualtumError(
                `${argName} is not valid hex.`,
                ErrorCode.INVALID_HEX_INPUT,
                { argName, received: value.slice(0, 16) + "…" }
            );
        }
        if (expectedLength !== null && value.length !== expectedLength) {
            throw new QualtumError(
                `${argName} must be ${expectedLength / 2} bytes (${expectedLength} hex chars), got ${value.length}.`,
                ErrorCode.INVALID_HEX_INPUT,
                { argName, expectedLength, actualLength: value.length }
            );
        }
    }

    _assertPositiveAmount(value, argName) {
        if (value === undefined || value === null) {
            throw new QualtumError(
                `${argName} is required.`,
                ErrorCode.MISSING_ARGUMENT,
                { argName }
            );
        }
        if (typeof value !== "number" || isNaN(value) || value <= 0) {
            throw new QualtumError(
                `${argName} must be a positive number, got ${value}.`,
                ErrorCode.AMOUNT_TOO_SMALL,
                { argName, received: value }
            );
        }
    }

    // Core Error Handler

    _handleError(err, method = "unknown", context = {}) {
        const base = { method, ...context };

        
        if (err instanceof QualtumError) throw err;

        // Transaction simulation failure
        if (err.logs && err.message?.includes("simulation")) {
            throw new QualtumError(
                "Transaction simulation failed. Check program logs.",
                ErrorCode.SIMULATION_FAILED,
                { ...base, logs: err.logs }
            );
        }

        // Insufficient lamports 
        if (err.message?.match(/insufficient lamports|not enough sol/i)) {
            throw new QualtumError(
                "Insufficient SOL balance to complete this transaction.",
                ErrorCode.INSUFFICIENT_FUNDS,
                { ...base, logs: err.logs ?? [] }
            );
        }

        //  Transaction timeout / blockhash expired 
        if (err.message?.match(/blockhash|timeout|expired/i)) {
            throw new QualtumError(
                "Transaction timed out or blockhash expired. Please retry.",
                ErrorCode.TRANSACTION_TIMEOUT,
                { ...base }
            );
        }

        // RPC / network failure 
        if (err.message?.match(/failed to fetch|network|ECONNREFUSED|503|429/i)) {
            throw new QualtumError(
                "RPC connection failed. Check your network or RPC endpoint.",
                ErrorCode.RPC_CONNECTION_FAILED,
                { ...base }
            );
        }

        // User rejected / wallet refused 
        if (err.message?.match(/user rejected|wallet.*declined/i)) {
            throw new QualtumError(
                "Transaction was rejected by the wallet.",
                ErrorCode.TRANSACTION_REJECTED,
                { ...base }
            );
        }
        //fallback
        throw new QualtumError(
            err.message ?? "An unknown error occurred.",
            ErrorCode.UNKNOWN,
            { ...base, logs: err.logs ?? [], originalError: err.name }
        );
    }
}