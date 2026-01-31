import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import prisma from "@/lib/db"
import { getUserFromRequest } from "@/lib/auth"

const revisionSchema = z.object({
  message: z.string().min(10),
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
    const validatedData = revisionSchema.parse(body)

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        package: true,
        deliveries: true,
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      )
    }

    // Only buyer can request revision
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

    // Check revision limit
    const revisionDeliveries = order.deliveries.filter((d) => d.isRevision)
    if (revisionDeliveries.length >= order.package.revisions) {
      return NextResponse.json(
        { error: "Revision limit reached" },
        { status: 400 }
      )
    }

    // Update order and add message
    const [updatedOrder] = await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: { status: "REVISION_REQUESTED" },
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
      prisma.orderMessage.create({
        data: {
          orderId: order.id,
          senderId: user.id,
          content: `Revision requested: ${validatedData.message}`,
        },
      }),
    ])

    // Create notification for seller
    await prisma.notification.create({
      data: {
        userId: order.sellerId,
        type: "REVISION_REQUESTED",
        title: "Revision Requested",
        message: `The buyer has requested a revision for their order.`,
        data: { orderId: order.id },
      },
    })

    return NextResponse.json({
      order: updatedOrder,
      revisionsRemaining: order.package.revisions - revisionDeliveries.length - 1,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Request revision error:", error)
    return NextResponse.json(
      { error: "Failed to request revision" },
      { status: 500 }
    )
  }
}
