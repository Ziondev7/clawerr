import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js'

const ESCROW_PROGRAM_ID = new PublicKey(
  process.env.ESCROW_PROGRAM_ID || '11111111111111111111111111111111'
)
const PLATFORM_WALLET = new PublicKey(
  process.env.PLATFORM_WALLET_ADDRESS || '11111111111111111111111111111111'
)
const PLATFORM_FEE_BPS = Number(process.env.PLATFORM_FEE_PERCENTAGE || 10) * 100 // Convert to basis points

export interface EscrowPdaResult {
  escrowPda: PublicKey
  vaultPda: PublicKey
  escrowBump: number
  vaultBump: number
}

export function getEscrowPdas(orderId: string): EscrowPdaResult {
  const orderIdBuffer = Buffer.from(orderId)

  const [escrowPda, escrowBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), orderIdBuffer],
    ESCROW_PROGRAM_ID
  )

  const [vaultPda, vaultBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), escrowPda.toBuffer()],
    ESCROW_PROGRAM_ID
  )

  return { escrowPda, vaultPda, escrowBump, vaultBump }
}

export function createInitializeEscrowInstruction(
  buyer: PublicKey,
  seller: PublicKey,
  orderId: string,
  amount: bigint
): TransactionInstruction {
  const { escrowPda, vaultPda } = getEscrowPdas(orderId)

  // Instruction data layout:
  // 0: instruction index (0 = initialize)
  // 1-8: amount (u64, little endian)
  // 9-end: order_id bytes
  const orderIdBytes = Buffer.from(orderId)
  const data = Buffer.alloc(1 + 8 + orderIdBytes.length)
  data.writeUInt8(0, 0) // instruction index
  data.writeBigUInt64LE(amount, 1)
  orderIdBytes.copy(data, 9)

  return new TransactionInstruction({
    keys: [
      { pubkey: buyer, isSigner: true, isWritable: true },
      { pubkey: seller, isSigner: false, isWritable: false },
      { pubkey: escrowPda, isSigner: false, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: ESCROW_PROGRAM_ID,
    data,
  })
}

export function createFundEscrowInstruction(
  buyer: PublicKey,
  orderId: string,
  amount: bigint
): TransactionInstruction {
  const { escrowPda, vaultPda } = getEscrowPdas(orderId)

  const data = Buffer.alloc(9)
  data.writeUInt8(1, 0) // instruction index (1 = fund)
  data.writeBigUInt64LE(amount, 1)

  return new TransactionInstruction({
    keys: [
      { pubkey: buyer, isSigner: true, isWritable: true },
      { pubkey: escrowPda, isSigner: false, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: ESCROW_PROGRAM_ID,
    data,
  })
}

export function createReleaseEscrowInstruction(
  authority: PublicKey, // buyer or platform
  seller: PublicKey,
  orderId: string
): TransactionInstruction {
  const { escrowPda, vaultPda } = getEscrowPdas(orderId)

  const data = Buffer.alloc(1)
  data.writeUInt8(2, 0) // instruction index (2 = release)

  return new TransactionInstruction({
    keys: [
      { pubkey: authority, isSigner: true, isWritable: false },
      { pubkey: seller, isSigner: false, isWritable: true },
      { pubkey: PLATFORM_WALLET, isSigner: false, isWritable: true },
      { pubkey: escrowPda, isSigner: false, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: ESCROW_PROGRAM_ID,
    data,
  })
}

export function createRefundEscrowInstruction(
  authority: PublicKey, // seller or platform
  buyer: PublicKey,
  orderId: string
): TransactionInstruction {
  const { escrowPda, vaultPda } = getEscrowPdas(orderId)

  const data = Buffer.alloc(1)
  data.writeUInt8(3, 0) // instruction index (3 = refund)

  return new TransactionInstruction({
    keys: [
      { pubkey: authority, isSigner: true, isWritable: false },
      { pubkey: buyer, isSigner: false, isWritable: true },
      { pubkey: escrowPda, isSigner: false, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: ESCROW_PROGRAM_ID,
    data,
  })
}

export function createDisputeEscrowInstruction(
  authority: PublicKey,
  orderId: string
): TransactionInstruction {
  const { escrowPda } = getEscrowPdas(orderId)

  const data = Buffer.alloc(1)
  data.writeUInt8(4, 0) // instruction index (4 = dispute)

  return new TransactionInstruction({
    keys: [
      { pubkey: authority, isSigner: true, isWritable: false },
      { pubkey: escrowPda, isSigner: false, isWritable: true },
      { pubkey: PLATFORM_WALLET, isSigner: false, isWritable: false },
    ],
    programId: ESCROW_PROGRAM_ID,
    data,
  })
}

export function createResolveDisputeInstruction(
  platformAuthority: PublicKey,
  buyer: PublicKey,
  seller: PublicKey,
  orderId: string,
  buyerPercentage: number // 0-100
): TransactionInstruction {
  const { escrowPda, vaultPda } = getEscrowPdas(orderId)

  const data = Buffer.alloc(2)
  data.writeUInt8(5, 0) // instruction index (5 = resolve_dispute)
  data.writeUInt8(buyerPercentage, 1)

  return new TransactionInstruction({
    keys: [
      { pubkey: platformAuthority, isSigner: true, isWritable: false },
      { pubkey: buyer, isSigner: false, isWritable: true },
      { pubkey: seller, isSigner: false, isWritable: true },
      { pubkey: PLATFORM_WALLET, isSigner: false, isWritable: true },
      { pubkey: escrowPda, isSigner: false, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: ESCROW_PROGRAM_ID,
    data,
  })
}

// Client helper class
export class EscrowClient {
  private connection: Connection

  constructor(rpcUrl: string = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com') {
    this.connection = new Connection(rpcUrl, 'confirmed')
  }

  async getEscrowAccount(orderId: string) {
    const { escrowPda } = getEscrowPdas(orderId)
    const accountInfo = await this.connection.getAccountInfo(escrowPda)

    if (!accountInfo) {
      return null
    }

    // Parse account data based on program layout
    // This would need to match your Anchor program's account structure
    const data = accountInfo.data
    return {
      exists: true,
      lamports: accountInfo.lamports,
      data,
    }
  }

  async getVaultBalance(orderId: string): Promise<bigint> {
    const { vaultPda } = getEscrowPdas(orderId)
    const balance = await this.connection.getBalance(vaultPda)
    return BigInt(balance)
  }

  async buildInitializeTransaction(
    buyer: PublicKey,
    seller: PublicKey,
    orderId: string,
    amount: bigint
  ): Promise<Transaction> {
    const tx = new Transaction()
    tx.add(createInitializeEscrowInstruction(buyer, seller, orderId, amount))
    tx.add(createFundEscrowInstruction(buyer, orderId, amount))

    const { blockhash } = await this.connection.getLatestBlockhash()
    tx.recentBlockhash = blockhash
    tx.feePayer = buyer

    return tx
  }

  async buildReleaseTransaction(
    authority: PublicKey,
    seller: PublicKey,
    orderId: string
  ): Promise<Transaction> {
    const tx = new Transaction()
    tx.add(createReleaseEscrowInstruction(authority, seller, orderId))

    const { blockhash } = await this.connection.getLatestBlockhash()
    tx.recentBlockhash = blockhash
    tx.feePayer = authority

    return tx
  }

  async buildRefundTransaction(
    authority: PublicKey,
    buyer: PublicKey,
    orderId: string
  ): Promise<Transaction> {
    const tx = new Transaction()
    tx.add(createRefundEscrowInstruction(authority, buyer, orderId))

    const { blockhash } = await this.connection.getLatestBlockhash()
    tx.recentBlockhash = blockhash
    tx.feePayer = authority

    return tx
  }

  getConnection(): Connection {
    return this.connection
  }
}

export const escrowClient = new EscrowClient()
