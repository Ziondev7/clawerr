use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

pub const PLATFORM_FEE_BPS: u64 = 1000; // 10% fee in basis points

#[program]
pub mod ai_agent_escrow {
    use super::*;

    /// Initialize a new escrow account for an order
    pub fn initialize_escrow(
        ctx: Context<InitializeEscrow>,
        order_id: String,
        amount: u64,
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;

        escrow.buyer = ctx.accounts.buyer.key();
        escrow.seller = ctx.accounts.seller.key();
        escrow.platform = ctx.accounts.platform.key();
        escrow.order_id = order_id;
        escrow.amount = amount;
        escrow.status = EscrowStatus::Initialized;
        escrow.bump = ctx.bumps.escrow;
        escrow.vault_bump = ctx.bumps.vault;
        escrow.created_at = Clock::get()?.unix_timestamp;

        msg!("Escrow initialized for order: {}", escrow.order_id);
        Ok(())
    }

    /// Fund the escrow - buyer deposits SOL
    pub fn fund_escrow(ctx: Context<FundEscrow>, amount: u64) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;

        require!(
            escrow.status == EscrowStatus::Initialized,
            EscrowError::InvalidStatus
        );
        require!(amount == escrow.amount, EscrowError::InvalidAmount);

        // Transfer SOL from buyer to vault
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            amount,
        )?;

        escrow.status = EscrowStatus::Funded;
        escrow.funded_at = Some(Clock::get()?.unix_timestamp);

        msg!("Escrow funded with {} lamports", amount);
        Ok(())
    }

    /// Release escrow funds to seller (called by buyer)
    pub fn release_escrow(ctx: Context<ReleaseEscrow>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;

        require!(
            escrow.status == EscrowStatus::Funded,
            EscrowError::InvalidStatus
        );
        require!(
            ctx.accounts.authority.key() == escrow.buyer ||
            ctx.accounts.authority.key() == escrow.platform,
            EscrowError::Unauthorized
        );

        // Calculate platform fee
        let platform_fee = (escrow.amount * PLATFORM_FEE_BPS) / 10000;
        let seller_amount = escrow.amount - platform_fee;

        // Transfer to seller
        let escrow_seeds = &[
            b"escrow".as_ref(),
            escrow.order_id.as_bytes(),
            &[escrow.bump],
        ];
        let signer_seeds = &[&escrow_seeds[..]];

        **ctx.accounts.vault.try_borrow_mut_lamports()? -= seller_amount;
        **ctx.accounts.seller.try_borrow_mut_lamports()? += seller_amount;

        // Transfer fee to platform
        if platform_fee > 0 {
            **ctx.accounts.vault.try_borrow_mut_lamports()? -= platform_fee;
            **ctx.accounts.platform.try_borrow_mut_lamports()? += platform_fee;
        }

        escrow.status = EscrowStatus::Released;
        escrow.released_at = Some(Clock::get()?.unix_timestamp);

        msg!(
            "Escrow released: {} to seller, {} to platform",
            seller_amount,
            platform_fee
        );
        Ok(())
    }

    /// Refund escrow to buyer (called by seller or platform)
    pub fn refund_escrow(ctx: Context<RefundEscrow>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;

        require!(
            escrow.status == EscrowStatus::Funded || escrow.status == EscrowStatus::Disputed,
            EscrowError::InvalidStatus
        );
        require!(
            ctx.accounts.authority.key() == escrow.seller ||
            ctx.accounts.authority.key() == escrow.platform,
            EscrowError::Unauthorized
        );

        // Transfer full amount back to buyer
        **ctx.accounts.vault.try_borrow_mut_lamports()? -= escrow.amount;
        **ctx.accounts.buyer.try_borrow_mut_lamports()? += escrow.amount;

        escrow.status = EscrowStatus::Refunded;
        escrow.refunded_at = Some(Clock::get()?.unix_timestamp);

        msg!("Escrow refunded: {} to buyer", escrow.amount);
        Ok(())
    }

    /// Open a dispute (called by buyer or seller)
    pub fn open_dispute(ctx: Context<OpenDispute>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;

        require!(
            escrow.status == EscrowStatus::Funded,
            EscrowError::InvalidStatus
        );
        require!(
            ctx.accounts.authority.key() == escrow.buyer ||
            ctx.accounts.authority.key() == escrow.seller,
            EscrowError::Unauthorized
        );

        escrow.status = EscrowStatus::Disputed;
        escrow.disputed_at = Some(Clock::get()?.unix_timestamp);

        msg!("Dispute opened for order: {}", escrow.order_id);
        Ok(())
    }

    /// Resolve dispute (called by platform only)
    pub fn resolve_dispute(
        ctx: Context<ResolveDispute>,
        buyer_percentage: u8,
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;

        require!(
            escrow.status == EscrowStatus::Disputed,
            EscrowError::InvalidStatus
        );
        require!(
            ctx.accounts.platform.key() == escrow.platform,
            EscrowError::Unauthorized
        );
        require!(buyer_percentage <= 100, EscrowError::InvalidPercentage);

        let buyer_amount = (escrow.amount * buyer_percentage as u64) / 100;
        let seller_amount = escrow.amount - buyer_amount;

        // Calculate platform fee from seller's portion only
        let platform_fee = (seller_amount * PLATFORM_FEE_BPS) / 10000;
        let seller_final = seller_amount - platform_fee;

        // Transfer to buyer
        if buyer_amount > 0 {
            **ctx.accounts.vault.try_borrow_mut_lamports()? -= buyer_amount;
            **ctx.accounts.buyer.try_borrow_mut_lamports()? += buyer_amount;
        }

        // Transfer to seller
        if seller_final > 0 {
            **ctx.accounts.vault.try_borrow_mut_lamports()? -= seller_final;
            **ctx.accounts.seller.try_borrow_mut_lamports()? += seller_final;
        }

        // Transfer fee to platform
        if platform_fee > 0 {
            **ctx.accounts.vault.try_borrow_mut_lamports()? -= platform_fee;
            **ctx.accounts.platform.try_borrow_mut_lamports()? += platform_fee;
        }

        escrow.status = EscrowStatus::Resolved;
        escrow.resolved_at = Some(Clock::get()?.unix_timestamp);
        escrow.resolution_buyer_amount = Some(buyer_amount);
        escrow.resolution_seller_amount = Some(seller_final);

        msg!(
            "Dispute resolved: {} to buyer, {} to seller, {} fee",
            buyer_amount,
            seller_final,
            platform_fee
        );
        Ok(())
    }
}

// ============ Accounts ============

#[derive(Accounts)]
#[instruction(order_id: String)]
pub struct InitializeEscrow<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    /// CHECK: Seller's wallet address
    pub seller: AccountInfo<'info>,

    /// CHECK: Platform wallet address
    pub platform: AccountInfo<'info>,

    #[account(
        init,
        payer = buyer,
        space = 8 + Escrow::INIT_SPACE,
        seeds = [b"escrow", order_id.as_bytes()],
        bump
    )]
    pub escrow: Account<'info, Escrow>,

    /// CHECK: Vault PDA to hold funds
    #[account(
        mut,
        seeds = [b"vault", escrow.key().as_ref()],
        bump
    )]
    pub vault: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FundEscrow<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        mut,
        constraint = escrow.buyer == buyer.key() @ EscrowError::Unauthorized
    )]
    pub escrow: Account<'info, Escrow>,

    /// CHECK: Vault PDA
    #[account(
        mut,
        seeds = [b"vault", escrow.key().as_ref()],
        bump = escrow.vault_bump
    )]
    pub vault: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReleaseEscrow<'info> {
    pub authority: Signer<'info>,

    #[account(mut)]
    pub escrow: Account<'info, Escrow>,

    /// CHECK: Vault PDA
    #[account(
        mut,
        seeds = [b"vault", escrow.key().as_ref()],
        bump = escrow.vault_bump
    )]
    pub vault: AccountInfo<'info>,

    /// CHECK: Seller receives payment
    #[account(
        mut,
        constraint = seller.key() == escrow.seller @ EscrowError::InvalidSeller
    )]
    pub seller: AccountInfo<'info>,

    /// CHECK: Platform receives fee
    #[account(
        mut,
        constraint = platform.key() == escrow.platform @ EscrowError::InvalidPlatform
    )]
    pub platform: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RefundEscrow<'info> {
    pub authority: Signer<'info>,

    #[account(mut)]
    pub escrow: Account<'info, Escrow>,

    /// CHECK: Vault PDA
    #[account(
        mut,
        seeds = [b"vault", escrow.key().as_ref()],
        bump = escrow.vault_bump
    )]
    pub vault: AccountInfo<'info>,

    /// CHECK: Buyer receives refund
    #[account(
        mut,
        constraint = buyer.key() == escrow.buyer @ EscrowError::InvalidBuyer
    )]
    pub buyer: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct OpenDispute<'info> {
    pub authority: Signer<'info>,

    #[account(mut)]
    pub escrow: Account<'info, Escrow>,
}

#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    pub platform: Signer<'info>,

    #[account(mut)]
    pub escrow: Account<'info, Escrow>,

    /// CHECK: Vault PDA
    #[account(
        mut,
        seeds = [b"vault", escrow.key().as_ref()],
        bump = escrow.vault_bump
    )]
    pub vault: AccountInfo<'info>,

    /// CHECK: Buyer may receive partial refund
    #[account(
        mut,
        constraint = buyer.key() == escrow.buyer @ EscrowError::InvalidBuyer
    )]
    pub buyer: AccountInfo<'info>,

    /// CHECK: Seller may receive partial payment
    #[account(
        mut,
        constraint = seller.key() == escrow.seller @ EscrowError::InvalidSeller
    )]
    pub seller: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

// ============ State ============

#[account]
#[derive(InitSpace)]
pub struct Escrow {
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub platform: Pubkey,
    #[max_len(64)]
    pub order_id: String,
    pub amount: u64,
    pub status: EscrowStatus,
    pub bump: u8,
    pub vault_bump: u8,
    pub created_at: i64,
    pub funded_at: Option<i64>,
    pub released_at: Option<i64>,
    pub refunded_at: Option<i64>,
    pub disputed_at: Option<i64>,
    pub resolved_at: Option<i64>,
    pub resolution_buyer_amount: Option<u64>,
    pub resolution_seller_amount: Option<u64>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum EscrowStatus {
    Initialized,
    Funded,
    Released,
    Refunded,
    Disputed,
    Resolved,
}

// ============ Errors ============

#[error_code]
pub enum EscrowError {
    #[msg("Invalid escrow status for this operation")]
    InvalidStatus,
    #[msg("Unauthorized to perform this action")]
    Unauthorized,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Invalid buyer")]
    InvalidBuyer,
    #[msg("Invalid seller")]
    InvalidSeller,
    #[msg("Invalid platform")]
    InvalidPlatform,
    #[msg("Invalid percentage (must be 0-100)")]
    InvalidPercentage,
}
