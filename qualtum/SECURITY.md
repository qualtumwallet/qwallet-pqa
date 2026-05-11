# Security Model: Crystals-Dilithium Commitment Signature Binding
**Qualtum Protocol Post-Quantum zecurity**

---

## Why Classical Signatures Break Under Quantum Attack


Solana accounts are secured by **Ed25519**, an elliptic curve signature scheme. Its security assumption is that deriving a private key from a public key requires solving the **Elliptic Curve Discrete Logarithm Problem (ECDLP)**  computationally infeasible for classical computers.

**Shor's Algorithm** collapses this assumption. A Cryptographically Relevant Quantum Computer (CRQC) can solve ECDLP in polynomial time. This means:

- Any on-chain public key can be reverse-engineered to its private key.
- Any broadcast-but-unconfirmed transaction can be intercepted, the private key extracted, and a competing transaction front-run.
- Long-term stored assets are retroactively vulnerable the moment a CRQC becomes available.

Ed25519 provides **zero post-quantum security margin**. The entire classical signature stack fails simultaneously.

---

## Why Dilithium5 Is Quantum Resistant

**Crystals-Dilithium5** is a NIST-standardized (FIPS 204) lattice-based signature scheme. Its hardness is grounded in two problems from lattice mathematics:

### Module Learning With Errors (MLWE)
Given a matrix **A** and vector **b = As + e** (where **s** is a secret and **e** is small random noise), recover **s**.

No known quantum algorithm  including Shor's or Grover's provides meaningful speedup against MLWE. The best quantum attacks remain exponential in the lattice dimension.

### Module Short Integer Solution (MSIS)
Find a short vector **z** such that **Az = 0 mod q**.

Again, quantum computers offer no asymptotic advantage over classical algorithms here. The security margin at Dilithium5 parameters is estimated at **256-bit post-quantum security**.

**Contrast with Ed25519:** Grover's algorithm gives a quadratic speedup against symmetric/hash primitives (reducing 256-bit to 128-bit effective security), but offers *no useful speedup* against the lattice problems underlying Dilithium5. The security does not degrade under quantum attack.

---

## The Commitment Signature Binding Scheme

Qualtum does not simply replace Ed25519 with Dilithium5. It constructs a **binding between the PQ identity and the Solana identity** through a commitment scheme. Here is how each layer works and why it is necessary.

### Step 1 — Identity Binding via Signature

```
Sig = Dilithium5_Sign(sk_pq, Solana_PublicKey)
```

The Dilithium private key signs the user's **Solana public key** as the message. This creates a cryptographic binding between the two identities.

**Why this matters:** A leaked or stolen Dilithium signature cannot be replayed against a different vault or wallet. The signature is mathematically tied to one specific Solana address. Without this binding, an attacker who obtained a valid PQ signature from one user could potentially reuse it elsewhere.

### Step 2 — Double-Hash Signature Commitment (DHSC)

```
Intermediate = SHA256(Sig)
Commitment   = SHA256(Intermediate)
```

Only `Commitment` is stored on-chain in the vault PDA. The raw signature (~4.6 KB) and the intermediate hash never touch the chain.

**Why double-hash and not single-hash?**

At withdrawal, the user submits `Intermediate`. The on-chain program computes:

```
Final = SHA256(Intermediate)
assert Final == stored Commitment
```

This means the on-chain verifier never sees the raw signature. Publishing `Intermediate` does not expose `Sig` SHA256 is a one-way function. And `Intermediate` itself was computed from `Sig`, which the attacker cannot forge without `sk_pq`.

A single hash would require submitting `Sig` directly to the chain, which would make the full ~4.6 KB signature public, increasing on-chain rent and exposing the signature to any observer. The two-layer scheme keeps the signature entirely off-chain while still allowing the program to verify knowledge of it.

### Step 3 — On-Chain Dual Verification

At withdrawal the program enforces both:

1. **Ed25519 check**  the Solana transaction must be signed by the vault owner's keypair (standard).
2. **PQ commitment check**  the submitted `Intermediate` must hash to the stored `Commitment`.

Both must pass. Neither alone is sufficient.

**Security consequence:** Even if a quantum attacker breaks Ed25519 and derives the Solana private key, they still cannot withdraw. They do not know `Intermediate`, cannot derive it without `Sig`, and cannot forge `Sig` without `sk_pq`  which is protected by the lattice problem, not elliptic curve math.

---

## Attack Surface Analysis

| Attack Vector | Classical Defense | Quantum Resistance |
| Derive Solana private key from public key | Ed25519 hardness (ECDLP) | **Broken** by Shor's Algorithm |
| Forge Dilithium5 signature | MSIS/MLWE hardness | **Holds** no quantum speedup |
| Pre-image attack on SHA256 commitment | 2^256 classical work | Grover reduces to 2^128  still infeasible |
| Replay PQ signature on different vault | Identity binding ties Sig to Solana pubkey | Same binding holds post-quantum |
| Extract raw signature from chain | Signature never stored on-chain | Off-chain secrecy maintained |
| Front-run withdrawal transaction | Standard mempool risk | Ed25519 layer remains + PQ proof still required |

---

## Threat Scenario: CRQC Becomes Available

Assume a quantum computer capable of breaking Ed25519 is deployed. Walk through what an attacker can and cannot do against a Qualtum vault:

**What the attacker can do:**
- Observe any Solana public key on-chain.
- Run Shor's Algorithm to derive the corresponding Ed25519 private key.
- Sign arbitrary Solana transactions as the vault owner.

**What the attacker cannot do:**
- They do not know `Intermediate` or `Sig`.
- They cannot compute `Intermediate` from the stored `Commitment`  SHA256 pre-image resistance holds even under Grover (128-bit security floor).
- Even if they somehow obtained `Intermediate`, they cannot produce a valid new `Sig` tied to a different target  the binding is over the original Solana public key.
- They cannot forge a Dilithium5 signature without solving MLWE/MSIS , the lattice problems that quantum computers do not accelerate.

**Result:** The vault is inaccessible to the quantum attacker. The classical Solana layer is broken; the PQ commitment layer is not.

---

## Key Security Properties Summary

**Quantum Resistance**  The authorization path requires knowledge of a Dilithium5 signature whose security is grounded in lattice problems with no known quantum vulnerability.

**Zero On-Chain Exposure**  The raw PQ signature is never published. Only its double-SHA256 image lives on-chain, preventing signature harvesting and minimizing rent cost.

**Identity Binding** The PQ signature commits to a specific Solana public key, eliminating cross-vault replay attacks.

**Defense in Depth**  Breaking one layer (Ed25519 via quantum attack) does not break the system. Both layers must be defeated simultaneously, and the second layer has no known quantum attack path.

**Non-Custodial**  The Dilithium private key and raw signature never leave the user's local environment. No trusted third party holds secrets.

---

## Standards Reference

- **Crystals-Dilithium5**  NIST FIPS 204 (August 2024), Module-Lattice-Based Digital Signature Standard.
- **SHA256** — NIST FIPS 180-4. Post-quantum security floor ~128 bits under Grover's Algorithm.
- **Shor's Algorithm**  P.W. Shor, 1994. Polynomial-time quantum algorithm for integer factorization and discrete logarithm.
- **Grover's Algorithm** L.K. Grover, 1996. Quadratic speedup for unstructured search; reduces symmetric key security by half.