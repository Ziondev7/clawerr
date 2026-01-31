import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/db"
import { getUserFromRequest } from "@/lib/auth"
import { verifyTransaction, type PaymentMethodType } from "@/lib/solana/escrow-client"
import { processOrderWithAgent } from "@/lib/agents/agent-executor"
import { getClawTokenMint } from "@/lib/solana/token-client"

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
    const { orderId, txSignature } = body

    if (!orderId || !txSignature) {
      return NextResponse.json(
        { error: "Order ID and transaction signature required" },
        { status: 400 }
      )
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        escrow: true,
        seller: {
          include: { agentProfile: true },
        },
        gig: true,
        package: true,
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      )
    }

    // Only buyer can confirm
    if (order.buyerId !== user.id) {
      return NextResponse.json(
        { error: "Not authorized" },
        { status: 403 }
      )
    }

    if (!order.escrow) {
      return NextResponse.json(
        { error: "Escrow not initialized" },
        { status: 400 }
      )
    }

    // Determine payment method and amount to verify
    const paymentMethod = (order.escrow.paymentMethod || "SOL") as PaymentMethodType
    const amountToVerify = paymentMethod === "CLAWERR"
      ? order.escrow.tokenAmount || BigInt(0)
      : order.priceLamports

    // Verify the transaction on-chain
    const verification = await verifyTransaction(
      txSignature,
      amountToVerify,
      paymentMethod === "CLAWERR"
        ? `clawerr:escrow:${orderId}`
        : `clawerr:escrow:${orderId}`,
      paymentMethod
    )

    if (!verification.verified) {
      return NextResponse.json(
        {
          error: "Transaction verification failed",
          details: verification.error,
        },
        { status: 400 }
      )
    }

    // Update escrow and order status
    const updates = [
      prisma.escrowTransaction.update({
        where: { id: order.escrow.id },
        data: {
          status: "FUNDED",
          fundedAt: new Date(),
          txSignature,
        },
      }),
      prisma.order.update({
        where: { id: order.id },
        data: { status: "IN_PROGRESS" },
      }),
    ]

    // Track token fee if applicable
    if (paymentMethod === "CLAWERR" && order.escrow.tokenAmount) {
      const tokenMint = getClawTokenMint()
      if (tokenMint) {
        updates.push(
          prisma.tokenFeeCollection.create({
            data: {
              orderId: order.id,
              tokenMint: tokenMint.toBase58(),
              amount: order.platformFee,
              feeType: "ORDER_FEE",
              txSignature,
            },
          }) as any
        )
      }
    }

    await prisma.$transaction(updates)

    // Create notification for seller
    await prisma.notification.create({
      data: {
        userId: order.sellerId,
        type: "ORDER_PAID",
        title: "New Order Received",
        message: `Payment confirmed! You have a new paid order.`,
        data: {
          orderId: order.id,
          txSignature,
          amount: order.priceLamports.toString(),
          paymentMethod,
          tokenAmount: order.escrow.tokenAmount?.toString(),
        },
      },
    })

    // If seller is an AI agent with auto-execute enabled, process automatically
    if (order.seller.agentProfile?.autoExecute) {
      try {
        // Execute agent in background (don't await to avoid timeout)
        processOrderWithAgent(prisma, order.id)
          .then((result) => {
            console.log(`Agent execution for order ${order.id}:`, result.status)
          })
          .catch((error) => {
            console.error(`Agent execution failed for order ${order.id}:`, error)
          })
      } catch (error) {
        console.error("Failed to start agent execution:", error)
        // Don't fail the request, seller can still deliver manually
      }
    }

    return NextResponse.json({
      success: true,
      message: "Payment verified and confirmed. Order is now in progress.",
      verification: {
        txSignature,
        sender: verification.sender,
        amount: verification.amount,
        paymentMethod,
      },
    })
  } catch (error) {
    console.error("Confirm escrow error:", error)
    return NextResponse.json(
      { error: "Failed to confirm payment" },
      { status: 500 }
    )
  }
}
