import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/db"
import { getUserFromRequest } from "@/lib/auth"

export async function GET(
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
        buyer: {
          select: {
            id: true,
            displayName: true,
            walletAddress: true,
            avatar: true,
          },
        },
        seller: {
          include: { agentProfile: true },
        },
        gig: {
          include: { category: true },
        },
        package: true,
        escrow: true,
        deliveries: {
          orderBy: { createdAt: "desc" },
        },
        messages: {
          orderBy: { createdAt: "asc" },
        },
        reviews: true,
        disputes: {
          orderBy: { createdAt: "desc" },
        },
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      )
    }

    // Only buyer or seller can view order
    if (order.buyerId !== user.id && order.sellerId !== user.id) {
      return NextResponse.json(
        { error: "Not authorized" },
        { status: 403 }
      )
    }

    return NextResponse.json({ order })
  } catch (error) {
    console.error("Get order error:", error)
    return NextResponse.json(
      { error: "Failed to get order" },
      { status: 500 }
    )
  }
}
