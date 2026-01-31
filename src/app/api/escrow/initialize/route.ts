import { NextRequest, NextResponse } from "next/server"
import { PublicKey } from "@solana/web3.js"
import prisma from "@/lib/db"
import { getUserFromRequest } from "@/lib/auth"
import {
  createEscrowTransaction,
  getPlatformWallet,
  calculateFees,
  isTokenPaymentEnabled,
  type PaymentMethodType,
} from "@/lib/solana/escrow-client"
import { getPlatformTokenATA, getClawTokenMint } from "@/lib/solana/token-client"

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { orderId, paymentMethod = "SOL", priceTokens } = body as {
      orderId: string
      paymentMethod?: PaymentMethodType
      priceTokens?: string
    }

    if (!orderId) {
      return NextResponse.json(
        { error: "Order ID required" },
        { status: 400 }
      )
    }

    // Validate token payment if selected
    if (paymentMethod === "CLAWERR") {
      if (!isTokenPaymentEnabled()) {
        return NextResponse.json(
          { error: "Token payments are not currently enabled" },
          { status: 400 }
        )
      }
      if (!priceTokens) {
        return NextResponse.json(
          { error: "Token amount required for CLAWERR payment" },
          { status: 400 }
        )
      }
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: true,
        seller: true,
        escrow: true,
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      )
    }

    // Only buyer can initialize escrow
    if (order.buyerId !== user.id) {
      return NextResponse.json(
        { error: "Not authorized" },
        { status: 403 }
      )
    }

    // Must be pending payment
    if (order.status !== "PENDING_PAYMENT") {
      return NextResponse.json(
        { error: "Order is not pending payment" },
        { status: 400 }
      )
    }

    // Check if escrow already exists and is pending
    if (order.escrow && order.escrow.status === "PENDING") {
      // Return existing escrow info
      const buyerPubkey = new PublicKey(order.buyer.walletAddress)
      const sellerPubkey = new PublicKey(order.seller.walletAddress)
      const tokenAmount = priceTokens ? BigInt(priceTokens) : undefined

      const escrowTx = await createEscrowTransaction({
        buyerWallet: buyerPubkey,
        sellerWallet: sellerPubkey,
        amountLamports: order.priceLamports,
        orderId: order.id,
        paymentMethod,
        amountTokens: tokenAmount,
      })

      return NextResponse.json({
        escrow: order.escrow,
        transaction: escrowTx.transaction
          .serialize({ requireAllSignatures: false })
          .toString("base64"),
        platformWallet: paymentMethod === "SOL"
          ? getPlatformWallet()?.toBase58()
          : getPlatformTokenATA()?.toBase58(),
        amountLamports: escrowTx.amountLamports.toString(),
        platformFee: escrowTx.platformFee.toString(),
        sellerAmount: escrowTx.sellerAmount.toString(),
        paymentMethod,
        amountTokens: tokenAmount?.toString(),
        message: "Escrow ready for payment",
      })
    }

    // Check platform wallet is configured based on payment method
    const platformWallet = getPlatformWallet()
    const platformTokenAta = getPlatformTokenATA()

    if (paymentMethod === "SOL" && !platformWallet) {
      return NextResponse.json(
        { error: "Platform wallet not configured. Contact support." },
        { status: 500 }
      )
    }

    if (paymentMethod === "CLAWERR" && !platformTokenAta) {
      return NextResponse.json(
        { error: "Platform token account not configured. Contact support." },
        { status: 500 }
      )
    }

    // Build the escrow transaction
    const buyerPubkey = new PublicKey(order.buyer.walletAddress)
    const sellerPubkey = new PublicKey(order.seller.walletAddress)
    const tokenAmount = priceTokens ? BigInt(priceTokens) : undefined

    const escrowTx = await createEscrowTransaction({
      buyerWallet: buyerPubkey,
      sellerWallet: sellerPubkey,
      amountLamports: order.priceLamports,
      orderId: order.id,
      paymentMethod,
      amountTokens: tokenAmount,
    })

    // Determine escrow PDA based on payment method
    const escrowPda = paymentMethod === "SOL"
      ? platformWallet!.toBase58()
      : platformTokenAta!.toBase58()

    // Create or update escrow record
    const escrow = await prisma.escrowTransaction.upsert({
      where: { orderId: order.id },
      create: {
        orderId: order.id,
        escrowPda,
        vaultPda: escrowPda,
        amountLamports: order.priceLamports,
        paymentMethod,
        tokenAmount,
        tokenMint: paymentMethod === "CLAWERR" ? getClawTokenMint()?.toBase58() : null,
        status: "PENDING",
      },
      update: {
        status: "PENDING",
        paymentMethod,
        tokenAmount,
        tokenMint: paymentMethod === "CLAWERR" ? getClawTokenMint()?.toBase58() : null,
      },
    })

    // Update order status and payment method
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "PAYMENT_PROCESSING",
        paymentMethod,
        priceTokens: tokenAmount,
      },
    })

    // Calculate fees
    const { platformFee, sellerAmount } = calculateFees(order.priceLamports)

    // Update order with platform fee
    await prisma.order.update({
      where: { id: order.id },
      data: { platformFee },
    })

    return NextResponse.json({
      escrow,
      transaction: escrowTx.transaction
        .serialize({ requireAllSignatures: false })
        .toString("base64"),
      platformWallet: escrowPda,
      amountLamports: order.priceLamports.toString(),
      platformFee: platformFee.toString(),
      sellerAmount: sellerAmount.toString(),
      paymentMethod,
      amountTokens: tokenAmount?.toString(),
    })
  } catch (error) {
    console.error("Initialize escrow error:", error)
    return NextResponse.json(
      { error: "Failed to initialize escrow" },
      { status: 500 }
    )
  }
}
