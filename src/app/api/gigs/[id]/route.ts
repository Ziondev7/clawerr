import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/db"
import { getUserFromRequest } from "@/lib/auth"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Try to find by ID first, then by slug
    let gig = await prisma.gig.findUnique({
      where: { id },
      include: {
        seller: {
          include: { agentProfile: true },
        },
        category: true,
        packages: {
          orderBy: {
            tier: "asc",
          },
        },
        faqs: {
          orderBy: { sortOrder: "asc" },
        },
      },
    })

    if (!gig) {
      gig = await prisma.gig.findUnique({
        where: { slug: id },
        include: {
          seller: {
            include: { agentProfile: true },
          },
          category: true,
          packages: {
            orderBy: {
              tier: "asc",
            },
          },
          faqs: {
            orderBy: { sortOrder: "asc" },
          },
        },
      })
    }

    if (!gig) {
      return NextResponse.json(
        { error: "Gig not found" },
        { status: 404 }
      )
    }

    // Get reviews for this gig's seller
    const reviews = await prisma.review.findMany({
      where: { targetId: gig.sellerId },
      include: {
        author: {
          select: {
            id: true,
            displayName: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    })

    return NextResponse.json({ gig, reviews })
  } catch (error) {
    console.error("Get gig error:", error)
    return NextResponse.json(
      { error: "Failed to get gig" },
      { status: 500 }
    )
  }
}

export async function PATCH(
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

    // Verify ownership
    const existingGig = await prisma.gig.findUnique({
      where: { id },
      select: { sellerId: true },
    })

    if (!existingGig) {
      return NextResponse.json(
        { error: "Gig not found" },
        { status: 404 }
      )
    }

    if (existingGig.sellerId !== user.id) {
      return NextResponse.json(
        { error: "Not authorized" },
        { status: 403 }
      )
    }

    const { packages, ...gigData } = body

    const gig = await prisma.gig.update({
      where: { id },
      data: gigData,
      include: {
        packages: true,
        category: true,
      },
    })

    return NextResponse.json({ gig })
  } catch (error) {
    console.error("Update gig error:", error)
    return NextResponse.json(
      { error: "Failed to update gig" },
      { status: 500 }
    )
  }
}

export async function DELETE(
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

    // Verify ownership
    const existingGig = await prisma.gig.findUnique({
      where: { id },
      select: { sellerId: true },
    })

    if (!existingGig) {
      return NextResponse.json(
        { error: "Gig not found" },
        { status: 404 }
      )
    }

    if (existingGig.sellerId !== user.id) {
      return NextResponse.json(
        { error: "Not authorized" },
        { status: 403 }
      )
    }

    await prisma.gig.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete gig error:", error)
    return NextResponse.json(
      { error: "Failed to delete gig" },
      { status: 500 }
    )
  }
}
