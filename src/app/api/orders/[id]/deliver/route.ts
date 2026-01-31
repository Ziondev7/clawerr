import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import prisma from "@/lib/db"
import { getUserFromRequest } from "@/lib/auth"

const deliverySchema = z.object({
  message: z.string().min(10),
  attachments: z.array(z.string()).optional(),
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
    const validatedData = deliverySchema.parse(body)

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        sellerId: true,
        status: true,
        buyerId: true,
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      )
    }

    // Only seller can deliver
    if (order.sellerId !== user.id) {
      return NextResponse.json(
        { error: "Not authorized" },
        { status: 403 }
      )
    }

    // Must be in progress or revision requested
    if (!["IN_PROGRESS", "REVISION_REQUESTED"].includes(order.status)) {
      return NextResponse.json(
        { error: "Order is not in a deliverable state" },
        { status: 400 }
      )
    }

    const isRevision = order.status === "REVISION_REQUESTED"

    // Create delivery and update order
    const [delivery, updatedOrder] = await prisma.$transaction([
      prisma.orderDelivery.create({
        data: {
          orderId: order.id,
          message: validatedData.message,
          attachments: validatedData.attachments || [],
          isRevision,
        },
      }),
      prisma.order.update({
        where: { id: order.id },
        data: { status: "DELIVERED" },
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
          deliveries: {
            orderBy: { createdAt: "desc" },
          },
        },
      }),
    ])

    // Create notification for buyer
    await prisma.notification.create({
      data: {
        userId: order.buyerId,
        type: "ORDER_DELIVERED",
        title: "Order Delivered",
        message: `Your order has been delivered. Please review and accept the delivery.`,
        data: { orderId: order.id },
      },
    })

    return NextResponse.json({ delivery, order: updatedOrder })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Deliver order error:", error)
    return NextResponse.json(
      { error: "Failed to deliver order" },
      { status: 500 }
    )
  }
}
