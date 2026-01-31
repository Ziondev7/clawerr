import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/db"
import { getUserFromRequest } from "@/lib/auth"
import { verifyTokenTransaction, getClawTokenMint } from "@/lib/solana/token-client"

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
    const { listingId, txSignature } = body

    if (!listingId || !txSignature) {
      return NextResponse.json(
        { error: "Listing ID and transaction signature required" },
        { status: 400 }
      )
    }

    // Get the pending listing
    const listing = await prisma.featuredListing.findUnique({
      where: { id: listingId },
      include: { gig: true },
    })

    if (!listing) {
      return NextResponse.json(
        { error: "Listing not found" },
        { status: 404 }
      )
    }

    if (listing.userId !== user.id) {
      return NextResponse.json(
        { error: "Not authorized" },
        { status: 403 }
      )
    }

    if (listing.status !== "PENDING_PAYMENT") {
      return NextResponse.json(
        { error: "Listing is not pending payment" },
        { status: 400 }
      )
    }

    // Verify the token transaction on-chain
    const verification = await verifyTokenTransaction(
      txSignature,
      listing.tokenAmount,
      `clawerr:featured:${listingId}`
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

    // Calculate dates
    const now = new Date()
    const expiresAt = new Date(now.getTime() + listing.durationDays * 24 * 60 * 60 * 1000)

    // Update listing and gig in transaction
    const tokenMint = getClawTokenMint()

    await prisma.$transaction([
      // Update featured listing to ACTIVE
      prisma.featuredListing.update({
        where: { id: listingId },
        data: {
          status: "ACTIVE",
          txSignature,
          startedAt: now,
          expiresAt,
        },
      }),
      // Update gig with featured status
      prisma.gig.update({
        where: { id: listing.gigId },
        data: {
          featured: true,
          featuredUntil: expiresAt,
        },
      }),
      // Record fee collection
      prisma.tokenFeeCollection.create({
        data: {
          listingId,
          tokenMint: tokenMint?.toBase58() || "",
          amount: listing.tokenAmount,
          feeType: "FEATURED_LISTING",
          txSignature,
        },
      }),
      // Create notification
      prisma.notification.create({
        data: {
          userId: user.id,
          type: "FEATURED_PURCHASED",
          title: "Gig Featured!",
          message: `Your gig "${listing.gig.title}" is now featured for ${listing.durationDays} days.`,
          data: {
            gigId: listing.gigId,
            listingId,
            expiresAt: expiresAt.toISOString(),
          },
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      message: "Featured listing activated!",
      listing: {
        id: listingId,
        status: "ACTIVE",
        startedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      },
      verification: {
        txSignature,
        amount: verification.amount?.toString(),
      },
    })
  } catch (error) {
    console.error("Featured confirm error:", error)
    return NextResponse.json(
      { error: "Failed to confirm featured payment" },
      { status: 500 }
    )
  }
}
