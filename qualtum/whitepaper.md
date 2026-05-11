# Qualtum: Post-Quantum Secure Vaults on Solana  (open source)
**Technical Whitepaper v1.0**

## 1. Executive Summary
Qualtum is a secondary security layer for the Solana blockchain designed to mitigate the threat of Cryptographically Relevant Quantum Computers (CRQC). By integrating NIST-standardized Crystals-Dilithium5 signatures with a Double-Hash Signature Commitment (DHSC) scheme, Qualtum ensures that on-chain assets remain secure even if the underlying ECDSA/Ed25519 elliptic curve cryptography is compromised.

## 2. Threat Model: The "Quantum Winter"
Standard Solana accounts rely on Ed25519. Shor’s Algorithm proves that quantum computers can derive private keys from public keys.
- **Pre-execution Risk:** Once a user signs a transaction, their public key is broadcast. A quantum attacker can intercept this, derive the private key, and front-run the transaction.
- **Qualtum Mitigation:** By requiring a Lattice-based (Post-Quantum) signature proof that is only revealed at the moment of withdrawal, the attack surface is eliminated.

## 3. The Qualtum Architecture

### 3.1 Dilithium5 Identity Binding
Unlike a simple password hash, Qualtum uses a **Crystals-Dilithium5 Keypair**. 
To tie the PQ identity to the Solana identity, the user generates a signature ($Sig$):
$$Sig = \text{Dilithium5\_Sign}(sk_{pq}, \text{Solana\_PublicKey})$$

This ensures that a leaked signature cannot be reused (replayed) on a different vault or wallet address.

### 3.2 Program Derived Address (PDA) Structure
The Qualtum vault is a PDA derived from the user's Solana Public Key, ensuring 1:1 mapping between wallets and vaults.

**Seeds:** `[ "pqvault", user_pubkey ]`

**Account Data Structure:**
| Field | Type | Description |
| :--- | :--- | :--- |
| `owner` | Pubkey | The Ed25519 Solana Address |
| `dilithium_commitment` | [u8; 32] | The Double-SHA256 of the PQ Signature |
| `bump` | u8 | PDA derivation bump |

### 3.3 The Double-Hash Signature Commitment (DHSC)
To maintain privacy and prevent signature-harvesting, Qualtum uses a two-stage hashing process:

1. **Commitment Phase (Off-Chain):**
   - Client calculates: `Intermediate = SHA256(Sig)`
   - Client calculates: `Commitment = SHA256(Intermediate)`
   - The `Commitment` is stored in the Vault PDA.

2. **Verification Phase (On-Chain):**
   - User submits the `Intermediate` hash.
   - The Solana Program executes: `Final = SHA256(Intermediate)`
   - If `Final == dilithium_commitment`, the withdrawal is authorized.

## 4. Operational Workflow

### Phase A: Initialization
1. User generates Dilithium5 keys locally.
2. User signs their Solana address using the Dilithium Private Key.
3. Client double-hashes the signature and calls `init_vault(commitment)`.
4. Solana PDA is created with the locked PQ commitment.

### Phase B: Deposit
- Standard SOL/SPL transfer into the PDA address. No PQ proof required for funding.

### Phase C: Post-Quantum Withdrawal
1. User retrieves their local Dilithium signature.
2. Client hashes the signature **once** to create the proof.
3. User signs the Solana transaction (Ed25519) and includes the PQ proof.
4. The Program verifies the Ed25519 signature (Standard) AND the PQ proof (Quantum-Safe).

## 5. Security Analysis
- **Lattice-Based Security:** Dilithium5 is resistant to known quantum attacks.
- **Zero-Knowledge Privacy:** The raw Dilithium signature (which is quite large, ~4.6KB) is never stored on-chain, saving rent costs and keeping the signature private.
- **Defense in Depth:** Even if a quantum computer breaks the Solana account key, it still cannot solve the pre-image of the Dilithium hash stored in the PDA.

## 6. Conclusion
Qualtum bridges the gap between current blockchain speed and future cryptographic necessity. It provides a non-custodial, persistent, and quantum-resistant environment for long-term wealth storage on the Solana network.