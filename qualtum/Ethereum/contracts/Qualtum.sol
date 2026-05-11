// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract Qualtum {

    struct Vault {
        address owner;
        bytes32 dilithiumCommitment;
        uint256 balance;
        bool initialized;
    }

    mapping(address => Vault) private vaults;

    event VaultInitialized(address indexed owner, bytes32 commitment);
    event Deposited(address indexed owner, uint256 amount);
    event Withdrawn(address indexed owner, uint256 amount);

    error VaultAlreadyExists();
    error VaultNotFound();
    error InvalidDilithiumHash();
    error InsufficientFunds();
    error NotOwner();

    function initVault(bytes32 commitment) external {
        if (vaults[msg.sender].initialized) revert VaultAlreadyExists();
        vaults[msg.sender] = Vault({
            owner: msg.sender,
            dilithiumCommitment: commitment,
            balance: 0,
            initialized: true
        });
        emit VaultInitialized(msg.sender, commitment);
    }

    function deposit() external payable {
        Vault storage vault = vaults[msg.sender];
        if (!vault.initialized) revert VaultNotFound();
        vault.balance += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    function withdraw(uint256 amount, bytes32 secretHash) external {
        Vault storage vault = vaults[msg.sender];
        if (!vault.initialized) revert VaultNotFound();
        if (vault.owner != msg.sender) revert NotOwner();

        bytes32 providedCommitment = sha256(abi.encodePacked(secretHash));
        if (vault.dilithiumCommitment != providedCommitment) revert InvalidDilithiumHash();

        if (vault.balance < amount) revert InsufficientFunds();
        vault.balance -= amount;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");

        emit Withdrawn(msg.sender, amount);
    }

    function getVault(address owner) external view returns (
        bytes32 commitment,
        uint256 balance,
        bool initialized
    ) {
        Vault storage vault = vaults[owner];
        return (vault.dilithiumCommitment, vault.balance, vault.initialized);
    }
}