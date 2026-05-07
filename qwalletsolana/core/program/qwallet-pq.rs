use anchor_lang::prelude::*;
use anchor_lang::solana_program::{system_instruction, program::{invoke, invoke_signed}};

declare_id!("AEJgjbJf4GW67izumzv7hQotMQMihBaedyNQ9U898zG7");

#[program]
pub mod qualtum {
    use super::*;

    pub fn init_vault(ctx: Context<InitVault>, commitment: [u8; 32]) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.dilithium_commitment = commitment;
        vault.owner = ctx.accounts.user.key(); // Storing owner to prevent unauthorized withdrawls
        vault.bump = ctx.bumps.vault;
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        let ix = system_instruction::transfer(
            &ctx.accounts.user.key(),
            &ctx.accounts.vault.key(),
            amount,
        );

        invoke(
            &ix,
            &[
                ctx.accounts.user.to_account_info(),
                ctx.accounts.vault.to_account_info(),
            ],
        )?;

        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64, secret_hash: [u8; 32]) -> Result<()> {
        // 1. Verify commitment (Post-Quantum Logic)
        let provided_commitment = anchor_lang::solana_program::hash::hash(&secret_hash).to_bytes();
        require!(
            ctx.accounts.vault.dilithium_commitment == provided_commitment,
            QualtumError::InvalidDilithiumHash
        );

        // 2. Security Check: Ensure the vault actually has enough SOL
        let rent_exemption = Rent::get()?.minimum_balance(ctx.accounts.vault.to_account_info().data_len());
        let vault_lamports = ctx.accounts.vault.to_account_info().lamports();
        
        require!(
            vault_lamports.checked_sub(amount).ok_or(QualtumError::Overflow)? >= rent_exemption,
            QualtumError::InsufficientFunds
        );

        // 3. PDA Signer Seeds
        let user_key = ctx.accounts.user_wallet.key();
        let seeds = &[
            b"pqvault", 
            user_key.as_ref(), 
            &[ctx.accounts.vault.bump]
        ];
        let signer = &[&seeds[..]];

        // 4. Transfer SOL
        let ix = system_instruction::transfer(
            &ctx.accounts.vault.key(),
            &ctx.accounts.user_wallet.key(),
            amount,
        );

        invoke_signed(
            &ix,
            &[
                ctx.accounts.vault.to_account_info(),
                ctx.accounts.user_wallet.to_account_info(),
            ],
            signer,
        )?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitVault<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 32 + 1, // Added 32 for owner pubkey
        seeds = [b"pqvault", user.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, VaultAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        mut,
        seeds = [b"pqvault", user.key().as_ref()],
        bump = vault.bump
    )]
    pub vault: Account<'info, VaultAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        mut,
        seeds = [b"pqvault", user_wallet.key().as_ref()],
        bump = vault.bump,
        has_one = owner, // Critical: Only the person who created the vault can withdraw
        close = owner    // Optional: Closes account and returns remaining rent to owner
    )]
    pub vault: Account<'info, VaultAccount>,
    #[account(mut)]
    pub owner: Signer<'info>, 
    #[account(mut)]
    pub user_wallet: SystemAccount<'info>, 
    pub system_program: Program<'info, System>,
}

#[account]
pub struct VaultAccount {
    pub owner: Pubkey, 
    pub dilithium_commitment: [u8; 32], 
    pub bump: u8,                   
}

#[error_code]
pub enum QualtumError {
    #[msg("Invalid Dilithium hash")]
    InvalidDilithiumHash,
    #[msg("Insufficient funds in vault")]
    InsufficientFunds,
    #[msg("Math overflow")]
    Overflow,
}
