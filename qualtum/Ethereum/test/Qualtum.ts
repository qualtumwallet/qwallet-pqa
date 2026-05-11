import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("Qualtum", function () {
  // Helper to compute DHSC — mirrors what pqSDK does
  // secretHash = SHA256(dilithium_sig), commitment = SHA256(secretHash)
  async function computeHashes(mockSig: string) {
    const secretHash = ethers.solidityPackedKeccak256(["string"], [mockSig]);
    const commitment = ethers.solidityPackedKeccak256(["bytes32"], [secretHash]);
    return { secretHash, commitment };
  }

  it("Should initialize a vault with a commitment", async function () {
    const qualtum = await ethers.deployContract("Qualtum");
    const [user] = await ethers.getSigners();
    const { commitment } = await computeHashes("mock_dilithium_sig");

    await qualtum.connect(user).initVault(commitment);

    const vault = await qualtum.getVault(user.address);
    expect(vault.initialized).to.equal(true);
    expect(vault.commitment).to.equal(commitment);
  });

  it("Should revert if vault already exists", async function () {
    const qualtum = await ethers.deployContract("Qualtum");
    const [user] = await ethers.getSigners();
    const { commitment } = await computeHashes("mock_dilithium_sig");

    await qualtum.connect(user).initVault(commitment);

    await expect(
      qualtum.connect(user).initVault(commitment)
    ).to.be.revertedWithCustomError(qualtum, "VaultAlreadyExists");
  });

  it("Should deposit ETH into the vault", async function () {
    const qualtum = await ethers.deployContract("Qualtum");
    const [user] = await ethers.getSigners();
    const { commitment } = await computeHashes("mock_dilithium_sig");

    await qualtum.connect(user).initVault(commitment);
    await qualtum.connect(user).deposit({ value: ethers.parseEther("1") });

    const vault = await qualtum.getVault(user.address);
    expect(vault.balance).to.equal(ethers.parseEther("1"));
  });

  it("Should withdraw with correct PQ hash", async function () {
    const qualtum = await ethers.deployContract("Qualtum");
    const [user] = await ethers.getSigners();
    const { secretHash, commitment } = await computeHashes("mock_dilithium_sig");

    await qualtum.connect(user).initVault(commitment);
    await qualtum.connect(user).deposit({ value: ethers.parseEther("2") });
    await qualtum.connect(user).withdraw(ethers.parseEther("1"), secretHash);

    const vault = await qualtum.getVault(user.address);
    expect(vault.balance).to.equal(ethers.parseEther("1"));
  });

  it("Should revert withdrawal with wrong PQ hash", async function () {
    const qualtum = await ethers.deployContract("Qualtum");
    const [user] = await ethers.getSigners();
    const { commitment } = await computeHashes("mock_dilithium_sig");
    const { secretHash: wrongHash } = await computeHashes("wrong_sig");

    await qualtum.connect(user).initVault(commitment);
    await qualtum.connect(user).deposit({ value: ethers.parseEther("1") });

    await expect(
      qualtum.connect(user).withdraw(ethers.parseEther("1"), wrongHash)
    ).to.be.revertedWithCustomError(qualtum, "InvalidDilithiumHash");
  });

  it("Should revert if non-owner tries to withdraw", async function () {
    const qualtum = await ethers.deployContract("Qualtum");
    const [user, attacker] = await ethers.getSigners();
    const { secretHash, commitment } = await computeHashes("mock_dilithium_sig");

    await qualtum.connect(user).initVault(commitment);
    await qualtum.connect(user).deposit({ value: ethers.parseEther("1") });

    await expect(
      qualtum.connect(attacker).withdraw(ethers.parseEther("1"), secretHash)
    ).to.be.revertedWithCustomError(qualtum, "VaultNotFound");
  });

  it("Should revert if insufficient funds", async function () {
    const qualtum = await ethers.deployContract("Qualtum");
    const [user] = await ethers.getSigners();
    const { secretHash, commitment } = await computeHashes("mock_dilithium_sig");

    await qualtum.connect(user).initVault(commitment);
    await qualtum.connect(user).deposit({ value: ethers.parseEther("1") });

    await expect(
      qualtum.connect(user).withdraw(ethers.parseEther("2"), secretHash)
    ).to.be.revertedWithCustomError(qualtum, "InsufficientFunds");
  });

  it("Should emit events on deposit and withdrawal", async function () {
    const qualtum = await ethers.deployContract("Qualtum");
    const [user] = await ethers.getSigners();
    const { secretHash, commitment } = await computeHashes("mock_dilithium_sig");

    await qualtum.connect(user).initVault(commitment);

    await expect(
      qualtum.connect(user).deposit({ value: ethers.parseEther("1") })
    ).to.emit(qualtum, "Deposited").withArgs(user.address, ethers.parseEther("1"));

    await expect(
      qualtum.connect(user).withdraw(ethers.parseEther("1"), secretHash)
    ).to.emit(qualtum, "Withdrawn").withArgs(user.address, ethers.parseEther("1"));
  });
});