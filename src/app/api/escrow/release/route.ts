import { NextRequest, NextResponse } from "next/server"
import { PublicKey } from "@solana/web3.js"
import prisma from "@/lib/db"
import { getUserFromRequest } from "@/lib/auth"
import { escrowClient } from "@/lib/solana/escrow"

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
    const { orderId } = body

    if (!orderId) {
      return NextResponse.json(
        { error: "Order ID required" },
        { status: 400 }
      )
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

    // Only buyer can release
    if (order.buyerId !== user.id) {
      return NextResponse.json(
        { error: "Not authorized" },
        { status: 403 }
      )
    }

    // Order must be completed
    if (order.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "Order must be completed to release escrow" },
        { status: 400 }
      )
    }

    if (!order.escrow || order.escrow.status !== "FUNDED") {
      return NextResponse.json(
        { error: "Escrow not funded" },
        { status: 400 }
      )
    }

    // Build release transaction
    const buyerPubkey = new PublicKey(order.buyer.walletAddress)
    const sellerPubkey = new PublicKey(order.seller.walletAddress)

    const transaction = await escrowClient.buildReleaseTransaction(
      buyerPubkey,
      sellerPubkey,
      order.id
    )

    return NextResponse.json({
      transaction: transaction.serialize({ requireAllSignatures: false }).toString("base64"),
      message: "Sign this transaction to release funds to the seller",
    })
  } catch (error) {
    console.error("Release escrow error:", error)
    return NextResponse.json(
      { error: "Failed to create release transaction" },
      { status: 500 }
    )
  }
}
