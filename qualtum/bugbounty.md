# Qualtum Bug Bounty

Qualtum is a post-quantum security layer handling long-term asset storage. Security is the entire product. If you find a vulnerability, we want to hear from you — and we'll make it worth your time.

---

## Scope

### In Scope

| Target | Description |
|--------|-------------|
| `Solana/programs/` | On-chain Anchor vault program |
| `Ethereum/contracts/` | Hardhat EVM vault contracts |
| `pqsdk` | Dilithium5 signing, DHSC commitment logic |
| Withdrawal verification | Dual Ed25519 + PQ commitment check |
| Identity binding | Cross-vault replay attack vectors |

### Out of Scope

- Third-party dependencies (report those upstream)
- Issues requiring physical access to a user's device
- Social engineering
- Theoretical attacks with no working proof of concept
- Frontend UI bugs with no security impact

---

## Severity & Rewards

| Severity | Example | Reward |
|----------|---------|--------|
| **Critical** | Bypass withdrawal verification, forge PQ commitment, drain vault without valid proof | Up to **$5,000** |
| **High** | Break identity binding, cross-vault replay, pre-image attack on DHSC | Up to **$2,000** |
| **Medium** | Denial of service on vault init/withdrawal, logic error with limited impact | Up to **$500** |
| **Low** | Info leakage, incorrect error handling, documentation gaps with security implications | Up to **$100** |

> Rewards are paid in SOL . Final reward amount is at maintainer discretion based on impact and quality of the report.

---

## How to Report

**Platform: coming soon **

Please include:

- A clear description of the vulnerability
- Affected component and file paths
- Steps to reproduce or a proof of concept
- Your assessment of the impact
- Your wallet address for reward payment

We will acknowledge your report within **48 hours** and aim to provide a resolution timeline within **7 days**.

---

## Disclosure Policy

- Please do not open public GitHub issues for vulnerabilities.
- Give us reasonable time to patch before any public disclosure — we ask for **90 days**.
- We will credit you in the fix commit and release notes unless you prefer to remain anonymous.
- We will not take legal action against researchers who follow this policy in good faith.

---

## Hall of Fame

Researchers who responsibly disclose valid vulnerabilities will be listed here.

| Researcher | Severity | Date |
|------------|----------|------|
| — | — | — |

---

*This bounty program is subject to change. Check this page for the latest terms before submitting.*