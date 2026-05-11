/**
 * 
 * open source under MIT
 */

import { ethers } from "ethers";



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

export class QualtumClientEth {
    constructor(contractAddress, abi, rpcUrl = "https://mainnet.infura.io/v3/YOUR_KEY") {
        this.contractAddress = contractAddress;
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.abi = abi;
    }

    /**
     * Initializes the contract with a signer (wallet).
     */
    getContract(signer) {
        return new ethers.Contract(this.contractAddress, this.abi, signer);
    }

    /**
     * Creates a new vault with a post-quantum commitment.
     */
    async initVault(signer, commitmentHex) {
        this._assertHex(commitmentHex, "commitmentHex", 64); // 32 bytes = 64 hex chars

        const contract = this.getContract(signer);
        const commitment = "0x" + commitmentHex;

        try {
            const tx = await contract.initVault(commitment);
            const receipt = await tx.wait();
            return { success: true, tx: receipt.hash };
        } catch (err) {
            this._handleError(err, "initVault", { wallet: await signer.getAddress() });
        }
    }

    /**
     * Deposits ETH into the vault.
     */
    async deposit(signer, amountEth) {
        this._assertPositiveAmount(amountEth, "amountEth");

        const contract = this.getContract(signer);
        const value = ethers.parseEther(String(amountEth));

        try {
            const tx = await contract.deposit({ value });
            const receipt = await tx.wait();
            return { success: true, tx: receipt.hash };
        } catch (err) {
            this._handleError(err, "deposit", {
                wallet: await signer.getAddress(),
                amountEth
            });
        }
    }

    /**
     * Withdraws ETH by providing the secret that hashes to the commitment.
     */
    async withdraw(signer, amountEth, secretHex) {
        this._assertPositiveAmount(amountEth, "amountEth");
        this._assertHex(secretHex, "secretHex");

        const contract = this.getContract(signer);
        const secret = "0x" + secretHex.padStart(64, "0");
        const amount = ethers.parseEther(String(amountEth));

        try {
            const tx = await contract.withdraw(amount, secret);
            const receipt = await tx.wait();
            return { success: true, tx: receipt.hash };
        } catch (err) {
            this._handleError(err, "withdraw", {
                wallet: await signer.getAddress(),
                amountEth
            });
        }
    }

    // Input Guards

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
        if (err.code === "CALL_EXCEPTION" || err.message?.includes("execution reverted")) {
            throw new QualtumError(
                "Transaction simulation failed. Check contract logs.",
                ErrorCode.SIMULATION_FAILED,
                { ...base, reason: err.reason ?? null }
            );
        }

        // Insufficient funds
        if (err.message?.match(/insufficient funds/i)) {
            throw new QualtumError(
                "Insufficient ETH balance to complete this transaction.",
                ErrorCode.INSUFFICIENT_FUNDS,
                { ...base }
            );
        }

        // Transaction timeout / nonce issues
        if (err.message?.match(/timeout|nonce|expired/i)) {
            throw new QualtumError(
                "Transaction timed out or nonce issue. Please retry.",
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
        if (err.message?.match(/user rejected|user denied/i)) {
            throw new QualtumError(
                "Transaction was rejected by the wallet.",
                ErrorCode.TRANSACTION_REJECTED,
                { ...base }
            );
        }

        // fallback
        throw new QualtumError(
            err.message ?? "An unknown error occurred.",
            ErrorCode.UNKNOWN,
            { ...base, originalError: err.name }
        );
    }
}