// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Qualtum} from "./Qualtum.sol";
import {Test} from "forge-std/Test.sol";

contract QualtumTest is Test {
    Qualtum qualtum;
    address user = address(0x1);
    bytes32 commitment;
    bytes32 secretHash;

    function setUp() public {
        qualtum = new Qualtum();

        // Simulate DHSC: secretHash = SHA256(dilithium_sig), commitment = SHA256(secretHash)
        secretHash = sha256(abi.encodePacked("mock_dilithium_signature"));
        commitment = sha256(abi.encodePacked(secretHash));

        // Fund the test user
        vm.deal(user, 10 ether);
    }

    function test_InitVault() public {
        vm.prank(user);
        qualtum.initVault(commitment);

        (, , bool initialized) = qualtum.getVault(user);
        require(initialized, "Vault should be initialized");
    }

    function test_CannotInitVaultTwice() public {
        vm.prank(user);
        qualtum.initVault(commitment);

        vm.prank(user);
        vm.expectRevert(Qualtum.VaultAlreadyExists.selector);
        qualtum.initVault(commitment);
    }

    function test_Deposit() public {
        vm.prank(user);
        qualtum.initVault(commitment);

        vm.prank(user);
        qualtum.deposit{value: 1 ether}();

        (, uint256 balance, ) = qualtum.getVault(user);
        require(balance == 1 ether, "Balance should be 1 ether");
    }

    function test_Withdraw() public {
        vm.prank(user);
        qualtum.initVault(commitment);

        vm.prank(user);
        qualtum.deposit{value: 2 ether}();

        vm.prank(user);
        qualtum.withdraw(1 ether, secretHash);

        (, uint256 balance, ) = qualtum.getVault(user);
        require(balance == 1 ether, "Balance should be 1 ether after withdrawal");
    }

    function test_WithdrawInvalidHash() public {
        vm.prank(user);
        qualtum.initVault(commitment);

        vm.prank(user);
        qualtum.deposit{value: 1 ether}();

        // Wrong secretHash — simulates attacker who doesn't know the dilithium sig
        bytes32 wrongHash = sha256(abi.encodePacked("wrong_signature"));

        vm.prank(user);
        vm.expectRevert(Qualtum.InvalidDilithiumHash.selector);
        qualtum.withdraw(1 ether, wrongHash);
    }

    function test_WithdrawInsufficientFunds() public {
        vm.prank(user);
        qualtum.initVault(commitment);

        vm.prank(user);
        qualtum.deposit{value: 1 ether}();

        vm.prank(user);
        vm.expectRevert(Qualtum.InsufficientFunds.selector);
        qualtum.withdraw(2 ether, secretHash);
    }

    function test_CannotWithdrawAsNonOwner() public {
        vm.prank(user);
        qualtum.initVault(commitment);

        vm.prank(user);
        qualtum.deposit{value: 1 ether}();

        // Different address tries to withdraw
        address attacker = address(0x2);
        vm.prank(attacker);
        vm.expectRevert(Qualtum.VaultNotFound.selector);
        qualtum.withdraw(1 ether, secretHash);
    }

    function testFuzz_DepositAndWithdraw(uint96 amount) public {
        vm.assume(amount > 0 && amount <= 5 ether);

        vm.prank(user);
        qualtum.initVault(commitment);

        vm.prank(user);
        qualtum.deposit{value: amount}();

        vm.prank(user);
        qualtum.withdraw(amount, secretHash);

        (, uint256 balance, ) = qualtum.getVault(user);
        require(balance == 0, "Balance should be 0 after full withdrawal");
    }
}