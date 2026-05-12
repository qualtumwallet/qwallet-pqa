# Contributing to Qualtum

Qualtum is an open-source post-quantum security layer for Solana and Ethereum. Contributions are welcome .please read this before opening a PR.

---

## Project Structure

```
qualtum/
├── Solana/        # Anchor program + client
├── Ethereum/      # Hardhat project (EVM vault contracts)
├── pqsdk/         # npm package — Dilithium5 wrapper & DHSC utilities
├── Shared/        # Shared types and constants
├── SECURITY.md
└── whitepaper.md
```

---

## Prerequisites

| Tool | Purpose |
|------|---------|
| Node.js `18+` | pqsdk, Ethereum (Hardhat), Solana client |
| Rust + Anchor CLI | Solana on-chain program |
| Solana CLI | Local validator |

---

## Setup

**pqsdk**
```bash
cd pqsdk && npm install && npm test
```

**Solana**
```bash
cd Solana && npm install && anchor build && anchor test
```

**Ethereum**
```bash
cd Ethereum && npm install && npx hardhat test
```

---

## Workflow

- For non-trivial changes, open an issue first.
- Branch off `main`: `feat/`, `fix/`, `docs/`, `test/` prefixes.
- All PRs must include tests. Any change to the DHSC logic or on-chain verification requires two maintainer approvals.
- Run linters before submitting: `npm run lint` (JS/TS), `cargo clippy` (Rust).

---

## Security

Do not open public issues for vulnerabilities.
Refer to bugbounty.md

---

## Questions
Open up discussions for Q&A about architecture
https://github.com/qualtumwallet/qwallet-pqa/discussions

