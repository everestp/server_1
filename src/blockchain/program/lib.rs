use anchor_lang::prelude::*;
use anchor_lang::solana_program::pubkey;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer};

declare_id!("2CZ1WzjHhgbBFaRaTxhLpdKQKAEsYDFga6bbuQRHfCJu");


// =====================================================
// GLOBAL CONFIG
// =====================================================

pub const ADMIN_WALLET: Pubkey =
    pubkey!("4faW5GHsCXwGgQAMmAL7sSENpaezCb63cncWvzGc8iJa");

pub const BREEZO_MINT: Pubkey =
    pubkey!("soQUnxjoEMCMxBroyS4AvrtVn2JCtPZnR3N53NA5AvU");


// =====================================================
// PROGRAM
// =====================================================

#[program]
pub mod breezo {
    use super::*;

    // =========================
    // INIT NODE (PDA)
    // =========================
    pub fn init_node(ctx: Context<InitNode>) -> Result<()> {
        let node = &mut ctx.accounts.node_account;

        node.owner = ctx.accounts.owner.key();
        node.device_public_key = ctx.accounts.device_public_key.key();
        node.reward_balance = 0;
        node.bump = ctx.bumps.node_account;

        Ok(())
    }

    // =========================
    // ADD REWARD (BACKEND)
    // =========================
    pub fn add_reward(ctx: Context<AddReward>, amount: u64) -> Result<()> {
        let node = &mut ctx.accounts.node_account;

        node.reward_balance = node.reward_balance
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;

        Ok(())
    }

    // =========================
    // CLAIM REWARD (TREASURY → USER)
    // =========================
    pub fn claim_reward(ctx: Context<ClaimReward>, amount: u64) -> Result<()> {
        let node = &mut ctx.accounts.node_account;

        require!(amount > 0, ErrorCode::NoReward);
        require!(node.reward_balance >= amount, ErrorCode::NoReward);
        require!(ctx.accounts.owner.key() == node.owner, ErrorCode::Unauthorized);

        node.reward_balance -= amount;

        // PDA signer seeds (FIXED)
        let seeds: &[&[u8]] = &[
            b"treasury",
            &[ctx.bumps.treasury_authority],
        ];

        let signer = &[seeds];

        let cpi_accounts = Transfer {
            from: ctx.accounts.treasury_token_account.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.treasury_authority.to_account_info(),
        };

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                signer,
            ),
            amount,
        )?;

        Ok(())
    }

    // =========================
    // BUY PRODUCT (USER → TREASURY)
    // =========================
    pub fn buy_product(ctx: Context<BuyProduct>, amount: u64) -> Result<()> {
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.treasury_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
            ),
            amount,
        )?;

        Ok(())
    }

    // =========================
    // WITHDRAW TREASURY (ADMIN ONLY)
    // =========================
    pub fn withdraw_treasury(ctx: Context<WithdrawTreasury>, amount: u64) -> Result<()> {
        require!(
            ctx.accounts.admin.key() == ADMIN_WALLET,
            ErrorCode::Unauthorized
        );

        let seeds: &[&[u8]] = &[
            b"treasury",
            &[ctx.bumps.treasury_authority],
        ];

        let signer = &[seeds];

        let cpi_accounts = Transfer {
            from: ctx.accounts.treasury_token_account.to_account_info(),
            to: ctx.accounts.admin_token_account.to_account_info(),
            authority: ctx.accounts.treasury_authority.to_account_info(),
        };

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                signer,
            ),
            amount,
        )?;

        Ok(())
    }
}


// =====================================================
// NODE STATE
// =====================================================

#[account]
pub struct NodeAccount {
    pub owner: Pubkey,
    pub device_public_key: Pubkey,
    pub reward_balance: u64,
    pub bump: u8,
}


// =====================================================
// ERRORS
// =====================================================

#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("No reward available")]
    NoReward,
    #[msg("Overflow")]
    Overflow,
}


// =====================================================
// INIT NODE ACCOUNTS
// =====================================================

#[derive(Accounts)]
pub struct InitNode<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 8 + 1,
        seeds = [
            b"node",
            owner.key().as_ref(),
            device_public_key.key().as_ref()
        ],
        bump
    )]
    pub node_account: Account<'info, NodeAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub owner: Signer<'info>,
    pub device_public_key: Signer<'info>,

    pub system_program: Program<'info, System>,
}


// =====================================================
// ADD REWARD
// =====================================================

#[derive(Accounts)]
pub struct AddReward<'info> {
    #[account(mut)]
    pub node_account: Account<'info, NodeAccount>,
    pub backend: Signer<'info>,
}


// =====================================================
// CLAIM REWARD
// =====================================================

#[derive(Accounts)]
pub struct ClaimReward<'info> {
    #[account(mut)]
    pub node_account: Account<'info, NodeAccount>,

    pub owner: Signer<'info>,

    #[account(address = BREEZO_MINT)]
    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub treasury_token_account: Account<'info, TokenAccount>,

    #[account(
        seeds = [b"treasury"],
        bump
    )]
    /// CHECK: PDA authority
    pub treasury_authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}


// =====================================================
// BUY PRODUCT
// =====================================================

#[derive(Accounts)]
pub struct BuyProduct<'info> {
    pub user: Signer<'info>,

    #[account(address = BREEZO_MINT)]
    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub treasury_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}


// =====================================================
// WITHDRAW TREASURY
// =====================================================

#[derive(Accounts)]
pub struct WithdrawTreasury<'info> {
    pub admin: Signer<'info>,

    #[account(address = BREEZO_MINT)]
    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub treasury_token_account: Account<'info, TokenAccount>,

    #[account(
        seeds = [b"treasury"],
        bump
    )]
    /// CHECK: PDA authority
    pub treasury_authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub admin_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}
