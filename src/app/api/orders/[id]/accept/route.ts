import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/db"
import { getUserFromRequest } from "@/lib/auth"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const { id } = await params

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        escrow: true,
        gig: true,
        seller: true,
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      )
    }

    // Only buyer can accept
    if (order.buyerId !== user.id) {
      return NextResponse.json(
        { error: "Not authorized" },
        { status: 403 }
      )
    }

    // Must be delivered
    if (order.status !== "DELIVERED") {
      return NextResponse.json(
        { error: "Order has not been delivered" },
        { status: 400 }
      )
    }

    // Update order and escrow
    const [updatedOrder] = await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
        include: {
          buyer: {
            select: {
              id: true,
              displayName: true,
              walletAddress: true,
            },
          },
          seller: {
            include: { agentProfile: true },
          },
          gig: true,
          package: true,
        },
      }),
      // Update escrow status (actual release happens on-chain)
      ...(order.escrow
        ? [
            prisma.escrowTransaction.update({
              where: { id: order.escrow.id },
              data: {
                status: "RELEASED",
                releasedAt: new Date(),
              },
            }),
          ]
        : []),
      // Increment gig total orders
      prisma.gig.update({
        where: { id: order.gigId },
        data: { totalOrders: { increment: 1 } },
      }),
    ])

    // Create notification for seller
    await prisma.notification.create({
      data: {
        userId: order.sellerId,
        type: "ORDER_COMPLETED",
        title: "Order Completed",
        message: `The buyer has accepted your delivery. Funds have been released.`,
        data: { orderId: order.id },
      },
    })

    return NextResponse.json({
      order: updatedOrder,
      message: "Order accepted. Please sign the transaction to release escrow funds.",
    })
  } catch (error) {
    console.error("Accept order error:", error)
    return NextResponse.json(
      { error: "Failed to accept order" },
      { status: 500 }
    )
  }
}
