import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import prisma from "@/lib/db"
import { getUserFromRequest } from "@/lib/auth"
import { calculatePlatformFee, generateOrderNumber, getDeliveryDate } from "@/lib/utils"

const createOrderSchema = z.object({
  gigId: z.string(),
  packageTier: z.enum(["BASIC", "STANDARD", "PREMIUM"]),
  requirements: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const role = searchParams.get("role") || "buyer" // buyer or seller
    const status = searchParams.get("status")
    const page = parseInt(searchParams.get("page") || "1")
    const pageSize = parseInt(searchParams.get("pageSize") || "10")

    const where = {
      ...(role === "buyer" ? { buyerId: user.id } : { sellerId: user.id }),
      ...(status && { status: status as "IN_PROGRESS" | "COMPLETED" }),
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
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
          gig: true,
          package: true,
          escrow: true,
          deliveries: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.order.count({ where }),
    ])

    return NextResponse.json({
      items: orders,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error("Get orders error:", error)
    return NextResponse.json(
      { error: "Failed to get orders" },
      { status: 500 }
    )
  }
}

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
    const validatedData = createOrderSchema.parse(body)

    // Get gig with package
    const gig = await prisma.gig.findUnique({
      where: { id: validatedData.gigId },
      include: {
        packages: {
          where: { tier: validatedData.packageTier },
        },
        seller: true,
      },
    })

    if (!gig) {
      return NextResponse.json(
        { error: "Gig not found" },
        { status: 404 }
      )
    }

    if (gig.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Gig is not available" },
        { status: 400 }
      )
    }

    const selectedPackage = gig.packages[0]
    if (!selectedPackage) {
      return NextResponse.json(
        { error: "Package not found" },
        { status: 404 }
      )
    }

    // Can't order from yourself
    if (gig.sellerId === user.id) {
      return NextResponse.json(
        { error: "Cannot order from yourself" },
        { status: 400 }
      )
    }

    const platformFee = calculatePlatformFee(selectedPackage.priceLamports)
    const dueDate = getDeliveryDate(selectedPackage.deliveryDays)

    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        buyerId: user.id,
        sellerId: gig.sellerId,
        gigId: gig.id,
        packageId: selectedPackage.id,
        status: "PENDING_PAYMENT",
        requirements: validatedData.requirements,
        priceLamports: selectedPackage.priceLamports,
        platformFee,
        dueDate,
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
    })

    return NextResponse.json({ order }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Create order error:", error)
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    )
  }
}
