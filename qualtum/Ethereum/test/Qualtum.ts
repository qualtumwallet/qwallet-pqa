import { expect } from "chai";
import { network } from "hardhat";
import { generateCDPair, signViaCD } from "../../pqsdk/lib/crystals_dilithium.js";
import { createHash } from "crypto";

const { ethers } = await network.create();

// DHSC Helper
// Mirrors the exact commitment flow from pqsdk usage:
//   signedMsg  = signViaCD(msg, secretkeybytes)         Uint8Array
//   hash_1     = SHA256(signedMsg)                      Buffer (32 bytes)
//   commitment = SHA256(hash_1)                         hex string
//
// On-chain Solidity receives secretHash (hash_1 as bytes32) and verifies:
//   keccak256(secretHash) == stored commitment
//


function computeDHSC(signedMsg: Uint8Array): { secretHash: string; commitment: string } {
  const hash1 = createHash("sha256").update(signedMsg).digest(); // Buffer, 32 bytes
  const hash2 = createHash("sha256").update(hash1).digest();     // Buffer, 32 bytes
  const secretHash = "0x" + hash1.toString("hex");               // bytes32 for on-chain
  const commitment = "0x" + hash2.toString("hex");               // stored in vault
  return { secretHash, commitment };
}

//Tests

describe("Qualtum", function () {

  // Generate a real Dilithium5 keypair once per suite.
  // signViaCD signs the deployer address as the message — matching the
  // identity binding described in the whitepaper:
  //   Sig = Dilithium5_Sign(sk_pq, Solana/ETH_PublicKey)
  let secretHash: string;
  let commitment: string;

  before(async function () {
    const [user] = await ethers.getSigners();

    // Real keypair ,no seed needed for test purposes
    const { publickeybytes, secretkeybytes } = generateCDPair(undefined);

    // Sign the user's ETH address as the bound message (identity binding)
    const signedMsg = signViaCD(user.address, secretkeybytes);

    // Compute DHSC from real signature
    ({ secretHash, commitment } = computeDHSC(signedMsg));
  });

  it("Should initialize a vault with a real PQ commitment", async function () {
    const qualtum = await ethers.deployContract("Qualtum");
    const [user] = await ethers.getSigners();

    await qualtum.connect(user).initVault(commitment);

    const vault = await qualtum.getVault(user.address);
    expect(vault.initialized).to.equal(true);
    expect(vault.commitment).to.equal(commitment);
  });

  it("Should revert if vault already exists", async function () {
    const qualtum = await ethers.deployContract("Qualtum");
    const [user] = await ethers.getSigners();

    await qualtum.connect(user).initVault(commitment);

    await expect(
      qualtum.connect(user).initVault(commitment)
    ).to.be.revertedWithCustomError(qualtum, "VaultAlreadyExists");
  });

  it("Should deposit ETH into the vault", async function () {
    const qualtum = await ethers.deployContract("Qualtum");
    const [user] = await ethers.getSigners();

    await qualtum.connect(user).initVault(commitment);
    await qualtum.connect(user).deposit({ value: ethers.parseEther("1") });

    const vault = await qualtum.getVault(user.address);
    expect(vault.balance).to.equal(ethers.parseEther("1"));
  });

  it("Should withdraw with correct PQ secretHash", async function () {
    const qualtum = await ethers.deployContract("Qualtum");
    const [user] = await ethers.getSigners();

    await qualtum.connect(user).initVault(commitment);
    await qualtum.connect(user).deposit({ value: ethers.parseEther("2") });
    await qualtum.connect(user).withdraw(ethers.parseEther("1"), secretHash);

    const vault = await qualtum.getVault(user.address);
    expect(vault.balance).to.equal(ethers.parseEther("1"));
  });

  it("Should revert withdrawal with wrong PQ secretHash", async function () {
    const qualtum = await ethers.deployContract("Qualtum");
    const [user] = await ethers.getSigners();

    // Generate a completely separate keypair to produce a wrong hash
    const { secretkeybytes: wrongKey } = generateCDPair(undefined);
    const wrongSignedMsg = signViaCD(user.address, wrongKey);
    const { secretHash: wrongSecretHash } = computeDHSC(wrongSignedMsg);

    await qualtum.connect(user).initVault(commitment);
    await qualtum.connect(user).deposit({ value: ethers.parseEther("1") });

    await expect(
      qualtum.connect(user).withdraw(ethers.parseEther("1"), wrongSecretHash)
    ).to.be.revertedWithCustomError(qualtum, "InvalidDilithiumHash");
  });

  it("Should revert if non-owner tries to withdraw", async function () {
    const qualtum = await ethers.deployContract("Qualtum");
    const [user, attacker] = await ethers.getSigners();

    await qualtum.connect(user).initVault(commitment);
    await qualtum.connect(user).deposit({ value: ethers.parseEther("1") });

    await expect(
      qualtum.connect(attacker).withdraw(ethers.parseEther("1"), secretHash)
    ).to.be.revertedWithCustomError(qualtum, "VaultNotFound");
  });

  it("Should revert if insufficient funds", async function () {
    const qualtum = await ethers.deployContract("Qualtum");
    const [user] = await ethers.getSigners();

    await qualtum.connect(user).initVault(commitment);
    await qualtum.connect(user).deposit({ value: ethers.parseEther("1") });

    await expect(
      qualtum.connect(user).withdraw(ethers.parseEther("2"), secretHash)
    ).to.be.revertedWithCustomError(qualtum, "InsufficientFunds");
  });

  it("Should emit events on deposit and withdrawal", async function () {
    const qualtum = await ethers.deployContract("Qualtum");
    const [user] = await ethers.getSigners();

    await qualtum.connect(user).initVault(commitment);

    await expect(
      qualtum.connect(user).deposit({ value: ethers.parseEther("1") })
    ).to.emit(qualtum, "Deposited").withArgs(user.address, ethers.parseEther("1"));

    await expect(
      qualtum.connect(user).withdraw(ethers.parseEther("1"), secretHash)
    ).to.emit(qualtum, "Withdrawn").withArgs(user.address, ethers.parseEther("1"));
  });

});