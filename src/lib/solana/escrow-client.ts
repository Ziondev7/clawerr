/**
 * Clawerr Solana Escrow Client
 *
 * Handles real SOL and $CLAWERR token transfers for the escrow system.
 * Uses a platform wallet to hold funds until order completion.
 */

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
  Keypair,
  sendAndConfirmTransaction,
} from "@solana/web3.js"
import {
  createTokenEscrowTransaction as createTokenEscrow,
  verifyTokenTransaction,
  getTokenBalance,
  formatTokens,
  parseTokensToBase,
  isTokenPaymentEnabled,
  getClawTokenMint,
} from "./token-client"

export type PaymentMethodType = "SOL" | "CLAWERR"

// Environment configuration
const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com"
const PLATFORM_WALLET = process.env.PLATFORM_WALLET_ADDRESS || ""
const PLATFORM_FEE_PERCENT = parseInt(process.env.PLATFORM_FEE_PERCENTAGE || "10")

export interface EscrowConfig {
  connection: Connection
  platformWallet: PublicKey
  feePercent: number
}

export interface CreateEscrowParams {
  buyerWallet: PublicKey
  sellerWallet: PublicKey
  amountLamports: bigint
  orderId: string
  paymentMethod?: PaymentMethodType
  amountTokens?: bigint
}

export interface EscrowTransaction {
  transaction: Transaction
  escrowAccount: PublicKey
  amountLamports: bigint
  platformFee: bigint
  sellerAmount: bigint
  paymentMethod: PaymentMethodType
  amountTokens?: bigint
}

export interface ReleaseParams {
  escrowAccount: PublicKey
  sellerWallet: PublicKey
  amountLamports: bigint
  platformFee: bigint
}

export interface RefundParams {
  escrowAccount: PublicKey
  buyerWallet: PublicKey
  amountLamports: bigint
}

/**
 * Get Solana connection
 */
export function getConnection(): Connection {
  return new Connection(SOLANA_RPC_URL, "confirmed")
}

/**
 * Get platform wallet public key
 */
export function getPlatformWallet(): PublicKey | null {
  if (!PLATFORM_WALLET) return null
  try {
    return new PublicKey(PLATFORM_WALLET)
  } catch {
    return null
  }
}

/**
 * Derive escrow PDA from order ID
 * This creates a deterministic address for each order's escrow
 */
export function deriveEscrowPDA(orderId: string, programId: PublicKey): [PublicKey, number] {
  const seeds = [
    Buffer.from("escrow"),
    Buffer.from(orderId),
  ]
  return PublicKey.findProgramAddressSync(seeds, programId)
}

/**
 * Calculate platform fee and seller amount
 */
export function calculateFees(amountLamports: bigint): {
  platformFee: bigint
  sellerAmount: bigint
} {
  const platformFee = (amountLamports * BigInt(PLATFORM_FEE_PERCENT)) / BigInt(100)
  const sellerAmount = amountLamports - platformFee
  return { platformFee, sellerAmount }
}

/**
 * Create an escrow funding transaction
 * Buyer sends SOL or $CLAWERR to the platform escrow wallet
 */
export async function createEscrowTransaction(
  params: CreateEscrowParams
): Promise<EscrowTransaction> {
  const paymentMethod = params.paymentMethod || "SOL"

  // Handle token payment
  if (paymentMethod === "CLAWERR") {
    if (!params.amountTokens) {
      throw new Error("Token amount required for CLAWERR payment")
    }

    const tokenResult = await createTokenEscrow({
      buyerWallet: params.buyerWallet,
      amountTokens: params.amountTokens,
      orderId: params.orderId,
    })

    const { platformFee, sellerAmount } = calculateFees(params.amountLamports)

    return {
      transaction: tokenResult.transaction,
      escrowAccount: tokenResult.platformAta,
      amountLamports: params.amountLamports,
      platformFee,
      sellerAmount,
      paymentMethod: "CLAWERR",
      amountTokens: params.amountTokens,
    }
  }

  // Handle SOL payment
  const connection = getConnection()
  const platformWallet = getPlatformWallet()

  if (!platformWallet) {
    throw new Error("Platform wallet not configured")
  }

  const { platformFee, sellerAmount } = calculateFees(params.amountLamports)

  // Create transaction to send SOL to platform wallet (escrow)
  const transaction = new Transaction()

  // Add memo instruction with order ID for tracking
  const memoInstruction = new TransactionInstruction({
    keys: [],
    programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
    data: Buffer.from(`clawerr:escrow:${params.orderId}`),
  })

  // Transfer SOL from buyer to platform wallet
  const transferInstruction = SystemProgram.transfer({
    fromPubkey: params.buyerWallet,
    toPubkey: platformWallet,
    lamports: Number(params.amountLamports),
  })

  transaction.add(memoInstruction)
  transaction.add(transferInstruction)

  // Get recent blockhash
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
  transaction.recentBlockhash = blockhash
  transaction.feePayer = params.buyerWallet

  return {
    transaction,
    escrowAccount: platformWallet,
    amountLamports: params.amountLamports,
    platformFee,
    sellerAmount,
    paymentMethod: "SOL",
  }
}

/**
 * Verify a transaction on-chain (SOL or token)
 */
export async function verifyTransaction(
  signature: string,
  expectedAmount: bigint,
  expectedMemo?: string,
  paymentMethod: PaymentMethodType = "SOL"
): Promise<{
  verified: boolean
  error?: string
  sender?: string
  receiver?: string
  amount?: number
}> {
  // Handle token verification
  if (paymentMethod === "CLAWERR") {
    const result = await verifyTokenTransaction(signature, expectedAmount, expectedMemo)
    return {
      ...result,
      amount: result.amount ? Number(result.amount) : undefined,
    }
  }

  // Handle SOL verification
  const connection = getConnection()

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
    if (!status.value?.confirmationStatus ||
        !["confirmed", "finalized"].includes(status.value.confirmationStatus)) {
      return { verified: false, error: "Transaction not confirmed" }
    }

    // Extract transfer amount from pre/post balances
    const preBalances = tx.meta?.preBalances || []
    const postBalances = tx.meta?.postBalances || []

    // The receiver should have increased balance
    const platformWallet = getPlatformWallet()
    if (platformWallet) {
      const accountKeys = tx.transaction.message.getAccountKeys()
      const platformIndex = accountKeys.staticAccountKeys.findIndex(
        key => key.equals(platformWallet)
      )

      if (platformIndex >= 0) {
        const received = postBalances[platformIndex] - preBalances[platformIndex]
        if (received < Number(expectedAmount)) {
          return {
            verified: false,
            error: `Insufficient amount: expected ${expectedAmount}, got ${received}`
          }
        }
      }
    }

    // Verify memo if provided
    if (expectedMemo && tx.meta?.logMessages) {
      const hasMemo = tx.meta.logMessages.some(log =>
        log.includes(expectedMemo)
      )
      if (!hasMemo) {
        return { verified: false, error: "Memo mismatch" }
      }
    }

    return {
      verified: true,
      sender: tx.transaction.message.getAccountKeys().staticAccountKeys[0]?.toBase58(),
      receiver: platformWallet?.toBase58(),
      amount: Number(expectedAmount),
    }
  } catch (error) {
    return {
      verified: false,
      error: error instanceof Error ? error.message : "Verification failed",
    }
  }
}

// Re-export token utilities
export {
  getTokenBalance,
  formatTokens,
  parseTokensToBase,
  isTokenPaymentEnabled,
  getClawTokenMint,
}

/**
 * Create a release transaction (platform sends to seller)
 * This should be called from a secure backend with the platform wallet keypair
 */
export async function createReleaseTransaction(
  params: ReleaseParams,
  platformKeypair: Keypair
): Promise<Transaction> {
  const connection = getConnection()
  const platformWallet = getPlatformWallet()

  if (!platformWallet) {
    throw new Error("Platform wallet not configured")
  }

  const sellerAmount = params.amountLamports - params.platformFee

  const transaction = new Transaction()

  // Transfer seller's portion
  const transferInstruction = SystemProgram.transfer({
    fromPubkey: platformWallet,
    toPubkey: params.sellerWallet,
    lamports: Number(sellerAmount),
  })

  transaction.add(transferInstruction)

  const { blockhash } = await connection.getLatestBlockhash()
  transaction.recentBlockhash = blockhash
  transaction.feePayer = platformWallet

  return transaction
}

/**
 * Create a refund transaction (platform sends back to buyer)
 */
export async function createRefundTransaction(
  params: RefundParams,
  platformKeypair: Keypair
): Promise<Transaction> {
  const connection = getConnection()
  const platformWallet = getPlatformWallet()

  if (!platformWallet) {
    throw new Error("Platform wallet not configured")
  }

  const transaction = new Transaction()

  // Transfer full amount back to buyer
  const transferInstruction = SystemProgram.transfer({
    fromPubkey: platformWallet,
    toPubkey: params.buyerWallet,
    lamports: Number(params.amountLamports),
  })

  transaction.add(transferInstruction)

  const { blockhash } = await connection.getLatestBlockhash()
  transaction.recentBlockhash = blockhash
  transaction.feePayer = platformWallet

  return transaction
}

/**
 * Get SOL balance for a wallet
 */
export async function getBalance(wallet: PublicKey): Promise<number> {
  const connection = getConnection()
  const balance = await connection.getBalance(wallet)
  return balance / LAMPORTS_PER_SOL
}

/**
 * Format lamports to SOL string
 */
export function formatSol(lamports: bigint | number): string {
  const sol = Number(lamports) / LAMPORTS_PER_SOL
  return sol.toFixed(sol < 0.01 ? 4 : 2)
}

/**
 * Parse SOL to lamports
 */
export function parseSolToLamports(sol: number): bigint {
  return BigInt(Math.floor(sol * LAMPORTS_PER_SOL))
}
