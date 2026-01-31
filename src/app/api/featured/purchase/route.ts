import { NextRequest, NextResponse } from "next/server"
import { PublicKey } from "@solana/web3.js"
import prisma from "@/lib/db"
import { getUserFromRequest } from "@/lib/auth"
import { createFeaturedPurchaseTransaction, isTokenPaymentEnabled } from "@/lib/solana/token-client"

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    if (!isTokenPaymentEnabled()) {
      return NextResponse.json(
        { error: "Token payments are not currently enabled" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { gigId, durationDays } = body

    if (!gigId || !durationDays) {
      return NextResponse.json(
        { error: "Gig ID and duration required" },
        { status: 400 }
      )
    }

    // Validate gig belongs to user
    const gig = await prisma.gig.findUnique({
      where: { id: gigId },
      include: { seller: true },
    })

    if (!gig) {
      return NextResponse.json(
        { error: "Gig not found" },
        { status: 404 }
      )
    }

    if (gig.sellerId !== user.id) {
      return NextResponse.json(
        { error: "You can only promote your own gigs" },
        { status: 403 }
      )
    }

    if (gig.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Only active gigs can be promoted" },
        { status: 400 }
      )
    }

    // Get pricing for selected duration
    const pricing = await prisma.featuredPricing.findUnique({
      where: { durationDays },
    })

    if (!pricing || !pricing.active) {
      return NextResponse.json(
        { error: "Invalid duration selected" },
        { status: 400 }
      )
    }

    // Check if gig is already featured
    const existingActive = await prisma.featuredListing.findFirst({
      where: {
        gigId,
        status: "ACTIVE",
        expiresAt: { gt: new Date() },
      },
    })

    if (existingActive) {
      return NextResponse.json(
        { error: "This gig is already featured" },
        { status: 400 }
      )
    }

    // Create pending featured listing
    const featuredListing = await prisma.featuredListing.create({
      data: {
        gigId,
        userId: user.id,
        status: "PENDING_PAYMENT",
        durationDays,
        tokenAmount: pricing.tokenAmount,
      },
    })

    // Build token transfer transaction
    const buyerWallet = new PublicKey(user.walletAddress)

    const { transaction, buyerAta, platformAta, amount } =
      await createFeaturedPurchaseTransaction({
        buyerWallet,
        amountTokens: pricing.tokenAmount,
        listingId: featuredListing.id,
      })

    return NextResponse.json({
      listing: {
        id: featuredListing.id,
        gigId: featuredListing.gigId,
        durationDays: featuredListing.durationDays,
        tokenAmount: featuredListing.tokenAmount.toString(),
        status: featuredListing.status,
      },
      transaction: transaction
        .serialize({ requireAllSignatures: false })
        .toString("base64"),
      buyerAta: buyerAta.toBase58(),
      platformAta: platformAta.toBase58(),
      amount: amount.toString(),
    })
  } catch (error) {
    console.error("Featured purchase error:", error)
    return NextResponse.json(
      { error: "Failed to initialize featured purchase" },
      { status: 500 }
    )
  }
}
