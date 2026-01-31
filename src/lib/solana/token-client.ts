/**
 * Clawerr SPL Token Client
 *
 * Handles $CLAWERR token operations including transfers, balance checks,
 * and transaction verification for the marketplace.
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js"
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAccount,
  TokenAccountNotFoundError,
} from "@solana/spl-token"
import { getConnection } from "./escrow-client"

// Environment configuration
const CLAWERR_TOKEN_MINT = process.env.NEXT_PUBLIC_CLAWERR_TOKEN_MINT || ""
const CLAWERR_TOKEN_DECIMALS = parseInt(process.env.NEXT_PUBLIC_CLAWERR_TOKEN_DECIMALS || "6")
const PLATFORM_TOKEN_ATA = process.env.PLATFORM_TOKEN_ATA || ""

export interface TokenConfig {
  mint: PublicKey
  decimals: number
  platformAta: PublicKey
}

export interface CreateTokenTransferParams {
  fromWallet: PublicKey
  toWallet: PublicKey
  amount: bigint
  memo?: string
}

export interface TokenEscrowParams {
  buyerWallet: PublicKey
  amountTokens: bigint
  orderId: string
}

export interface FeaturedPurchaseParams {
  buyerWallet: PublicKey
  amountTokens: bigint
  listingId: string
}

/**
 * Get $CLAWERR token mint public key
 */
export function getClawTokenMint(): PublicKey | null {
  if (!CLAWERR_TOKEN_MINT) return null
  try {
    return new PublicKey(CLAWERR_TOKEN_MINT)
  } catch {
    return null
  }
}

/**
 * Get platform's associated token account for $CLAWERR
 */
export function getPlatformTokenATA(): PublicKey | null {
  if (!PLATFORM_TOKEN_ATA) return null
  try {
    return new PublicKey(PLATFORM_TOKEN_ATA)
  } catch {
    return null
  }
}

/**
 * Get token decimals
 */
export function getTokenDecimals(): number {
  return CLAWERR_TOKEN_DECIMALS
}

/**
 * Get or derive associated token account for a wallet
 */
export async function getOrCreateATA(
  wallet: PublicKey,
  mint?: PublicKey
): Promise<{
  ata: PublicKey
  instruction?: TransactionInstruction
}> {
  const tokenMint = mint || getClawTokenMint()
  if (!tokenMint) {
    throw new Error("Token mint not configured")
  }

  const ata = await getAssociatedTokenAddress(
    tokenMint,
    wallet,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  )

  const connection = getConnection()

  try {
    await getAccount(connection, ata)
    return { ata }
  } catch (error) {
    if (error instanceof TokenAccountNotFoundError) {
      const instruction = createAssociatedTokenAccountInstruction(
        wallet, // payer
        ata, // associatedToken
        wallet, // owner
        tokenMint, // mint
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
      return { ata, instruction }
    }
    throw error
  }
}

/**
 * Create memo instruction for tracking
 */
function createMemoInstruction(memo: string): TransactionInstruction {
  return new TransactionInstruction({
    keys: [],
    programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
    data: Buffer.from(memo),
  })
}

/**
 * Create a token transfer transaction
 */
export async function createTokenTransferTransaction(
  params: CreateTokenTransferParams
): Promise<Transaction> {
  const connection = getConnection()
  const tokenMint = getClawTokenMint()

  if (!tokenMint) {
    throw new Error("Token mint not configured")
  }

  const transaction = new Transaction()

  // Get or create sender's ATA
  const senderAta = await getAssociatedTokenAddress(
    tokenMint,
    params.fromWallet
  )

  // Get or create receiver's ATA
  const receiverAtaResult = await getOrCreateATA(params.toWallet)

  // Add ATA creation instruction if needed
  if (receiverAtaResult.instruction) {
    transaction.add(receiverAtaResult.instruction)
  }

  // Add memo if provided
  if (params.memo) {
    transaction.add(createMemoInstruction(params.memo))
  }

  // Add transfer instruction
  transaction.add(
    createTransferInstruction(
      senderAta,
      receiverAtaResult.ata,
      params.fromWallet,
      params.amount
    )
  )

  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash()
  transaction.recentBlockhash = blockhash
  transaction.feePayer = params.fromWallet

  return transaction
}

/**
 * Create token escrow transaction for orders
 * Buyer sends $CLAWERR to platform token account
 */
export async function createTokenEscrowTransaction(
  params: TokenEscrowParams
): Promise<{
  transaction: Transaction
  buyerAta: PublicKey
  platformAta: PublicKey
  amount: bigint
}> {
  const connection = getConnection()
  const tokenMint = getClawTokenMint()
  const platformAta = getPlatformTokenATA()

  if (!tokenMint) {
    throw new Error("Token mint not configured")
  }

  if (!platformAta) {
    throw new Error("Platform token account not configured")
  }

  const transaction = new Transaction()

  // Get buyer's ATA
  const buyerAta = await getAssociatedTokenAddress(
    tokenMint,
    params.buyerWallet
  )

  // Add memo for tracking
  transaction.add(
    createMemoInstruction(`clawerr:escrow:${params.orderId}`)
  )

  // Transfer tokens from buyer to platform
  transaction.add(
    createTransferInstruction(
      buyerAta,
      platformAta,
      params.buyerWallet,
      params.amountTokens
    )
  )

  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash()
  transaction.recentBlockhash = blockhash
  transaction.feePayer = params.buyerWallet

  return {
    transaction,
    buyerAta,
    platformAta,
    amount: params.amountTokens,
  }
}

/**
 * Create token transaction for featured listing purchase
 */
export async function createFeaturedPurchaseTransaction(
  params: FeaturedPurchaseParams
): Promise<{
  transaction: Transaction
  buyerAta: PublicKey
  platformAta: PublicKey
  amount: bigint
}> {
  const connection = getConnection()
  const tokenMint = getClawTokenMint()
  const platformAta = getPlatformTokenATA()

  if (!tokenMint) {
    throw new Error("Token mint not configured")
  }

  if (!platformAta) {
    throw new Error("Platform token account not configured")
  }

  const transaction = new Transaction()

  // Get buyer's ATA
  const buyerAta = await getAssociatedTokenAddress(
    tokenMint,
    params.buyerWallet
  )

  // Add memo for tracking
  transaction.add(
    createMemoInstruction(`clawerr:featured:${params.listingId}`)
  )

  // Transfer tokens from buyer to platform
  transaction.add(
    createTransferInstruction(
      buyerAta,
      platformAta,
      params.buyerWallet,
      params.amountTokens
    )
  )

  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash()
  transaction.recentBlockhash = blockhash
  transaction.feePayer = params.buyerWallet

  return {
    transaction,
    buyerAta,
    platformAta,
    amount: params.amountTokens,
  }
}

/**
 * Get token balance for a wallet
 */
export async function getTokenBalance(wallet: PublicKey): Promise<{
  balance: bigint
  uiBalance: number
}> {
  const connection = getConnection()
  const tokenMint = getClawTokenMint()

  if (!tokenMint) {
    return { balance: BigInt(0), uiBalance: 0 }
  }

  try {
    const ata = await getAssociatedTokenAddress(tokenMint, wallet)
    const account = await getAccount(connection, ata)
    const balance = account.amount
    const uiBalance = Number(balance) / Math.pow(10, CLAWERR_TOKEN_DECIMALS)
    return { balance, uiBalance }
  } catch (error) {
    if (error instanceof TokenAccountNotFoundError) {
      return { balance: BigInt(0), uiBalance: 0 }
    }
    throw error
  }
}

/**
 * Verify a token transaction on-chain
 */
export async function verifyTokenTransaction(
  signature: string,
  expectedAmount: bigint,
  expectedMemo?: string
): Promise<{
  verified: boolean
  error?: string
  sender?: string
  receiver?: string
  amount?: bigint
}> {
  const connection = getConnection()
  const platformAta = getPlatformTokenATA()

  if (!platformAta) {
    return { verified: false, error: "Platform token account not configured" }
  }

  try {
    // Get transaction details
    const tx = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    })

    if (!tx) {
      return { verified: false, error: "Transaction not found" }
    }

    if (tx.meta?.err) {
      return { verified: false, error: "Transaction failed on-chain" }
    }

    // Check if transaction is confirmed
    const status = await connection.getSignatureStatus(signature)
    if (
      !status.value?.confirmationStatus ||
      !["confirmed", "finalized"].includes(status.value.confirmationStatus)
    ) {
      return { verified: false, error: "Transaction not confirmed" }
    }

    // Verify memo if provided
    if (expectedMemo && tx.meta?.logMessages) {
      const hasMemo = tx.meta.logMessages.some((log) =>
        log.includes(expectedMemo)
      )
      if (!hasMemo) {
        return { verified: false, error: "Memo mismatch" }
      }
    }

    // Check token balance changes in pre/post token balances
    const preTokenBalances = tx.meta?.preTokenBalances || []
    const postTokenBalances = tx.meta?.postTokenBalances || []

    // Find the platform's token account balance change
    const platformAtaString = platformAta.toBase58()
    const preBalance = preTokenBalances.find(
      (b) => b.owner === platformAtaString || b.mint === CLAWERR_TOKEN_MINT
    )
    const postBalance = postTokenBalances.find(
      (b) => b.owner === platformAtaString || b.mint === CLAWERR_TOKEN_MINT
    )

    // Calculate received amount from token balance changes
    let receivedAmount = BigInt(0)
    if (postBalance?.uiTokenAmount?.amount && preBalance?.uiTokenAmount?.amount) {
      receivedAmount = BigInt(postBalance.uiTokenAmount.amount) - BigInt(preBalance.uiTokenAmount.amount)
    } else if (postBalance?.uiTokenAmount?.amount) {
      receivedAmount = BigInt(postBalance.uiTokenAmount.amount)
    }

    // Allow for some flexibility in verification (the amount should be at least expected)
    if (receivedAmount < expectedAmount) {
      return {
        verified: false,
        error: `Insufficient amount: expected ${expectedAmount}, got ${receivedAmount}`,
      }
    }

    // Get sender from first account key (fee payer)
    const accountKeys = tx.transaction.message.getAccountKeys()
    const sender = accountKeys.staticAccountKeys[0]?.toBase58()

    return {
      verified: true,
      sender,
      receiver: platformAtaString,
      amount: receivedAmount,
    }
  } catch (error) {
    return {
      verified: false,
      error: error instanceof Error ? error.message : "Verification failed",
    }
  }
}

/**
 * Format token amount to human-readable string
 */
export function formatTokens(amount: bigint | number): string {
  const num = Number(amount) / Math.pow(10, CLAWERR_TOKEN_DECIMALS)
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + "M"
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(2) + "K"
  }
  return num.toFixed(num < 1 ? 4 : 2)
}

/**
 * Parse token amount from human-readable to base units
 */
export function parseTokensToBase(tokens: number): bigint {
  return BigInt(Math.floor(tokens * Math.pow(10, CLAWERR_TOKEN_DECIMALS)))
}

/**
 * Check if token payments are enabled
 */
export function isTokenPaymentEnabled(): boolean {
  return Boolean(CLAWERR_TOKEN_MINT && PLATFORM_TOKEN_ATA)
}
