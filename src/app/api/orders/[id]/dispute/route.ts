import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import prisma from "@/lib/db"
import { getUserFromRequest } from "@/lib/auth"

const disputeSchema = z.object({
  reason: z.string().min(5),
  description: z.string().min(20),
  evidence: z.array(z.string()).optional(),
})

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
    const body = await request.json()
    const validatedData = disputeSchema.parse(body)

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        escrow: true,
        disputes: true,
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      )
    }

    // Only buyer or seller can open dispute
    if (order.buyerId !== user.id && order.sellerId !== user.id) {
      return NextResponse.json(
        { error: "Not authorized" },
        { status: 403 }
      )
    }

    // Check if there's already an open dispute
    const openDispute = order.disputes.find(
      (d) => !["RESOLVED_BUYER", "RESOLVED_SELLER", "RESOLVED_SPLIT", "CLOSED"].includes(d.status)
    )
    if (openDispute) {
      return NextResponse.json(
        { error: "There is already an open dispute for this order" },
        { status: 400 }
      )
    }

    // Must be in a disputable state
    if (!["IN_PROGRESS", "DELIVERED", "REVISION_REQUESTED"].includes(order.status)) {
      return NextResponse.json(
        { error: "Order cannot be disputed in its current state" },
        { status: 400 }
      )
    }

    // Create dispute and update order
    const [dispute] = await prisma.$transaction([
      prisma.dispute.create({
        data: {
          orderId: order.id,
          openedById: user.id,
          reason: validatedData.reason,
          description: validatedData.description,
          evidence: validatedData.evidence || [],
          status: "OPEN",
        },
      }),
      prisma.order.update({
        where: { id: order.id },
        data: { status: "DISPUTED" },
      }),
      // Update escrow status if exists
      ...(order.escrow
        ? [
            prisma.escrowTransaction.update({
              where: { id: order.escrow.id },
              data: { status: "DISPUTED" },
            }),
          ]
        : []),
    ])

    // Notify the other party
    const otherPartyId = user.id === order.buyerId ? order.sellerId : order.buyerId
    await prisma.notification.create({
      data: {
        userId: otherPartyId,
        type: "DISPUTE_OPENED",
        title: "Dispute Opened",
        message: `A dispute has been opened for your order.`,
        data: { orderId: order.id, disputeId: dispute.id },
      },
    })

    return NextResponse.json({ dispute })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Open dispute error:", error)
    return NextResponse.json(
      { error: "Failed to open dispute" },
      { status: 500 }
    )
  }
}
