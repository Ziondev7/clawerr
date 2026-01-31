import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/db"

const CRON_SECRET = process.env.CRON_SECRET

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get("authorization")
    const providedSecret = authHeader?.replace("Bearer ", "")

    if (CRON_SECRET && providedSecret !== CRON_SECRET) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const now = new Date()

    // Find expired featured listings
    const expiredListings = await prisma.featuredListing.findMany({
      where: {
        status: "ACTIVE",
        expiresAt: { lte: now },
      },
      include: {
        gig: true,
        user: true,
      },
    })

    if (expiredListings.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No expired listings to process",
        processed: 0,
      })
    }

    // Process each expired listing
    const results = await Promise.allSettled(
      expiredListings.map(async (listing) => {
        // Check if there's another active listing for this gig
        const otherActiveListing = await prisma.featuredListing.findFirst({
          where: {
            gigId: listing.gigId,
            status: "ACTIVE",
            expiresAt: { gt: now },
            id: { not: listing.id },
          },
        })

        const shouldUnfeature = !otherActiveListing

        await prisma.$transaction([
          // Mark listing as expired
          prisma.featuredListing.update({
            where: { id: listing.id },
            data: { status: "EXPIRED" },
          }),
          // Update gig featured status if no other active listing
          ...(shouldUnfeature
            ? [
                prisma.gig.update({
                  where: { id: listing.gigId },
                  data: {
                    featured: false,
                    featuredUntil: null,
                  },
                }),
              ]
            : []),
          // Create notification
          prisma.notification.create({
            data: {
              userId: listing.userId,
              type: "FEATURED_EXPIRED",
              title: "Featured Listing Expired",
              message: `Your featured listing for "${listing.gig.title}" has expired.`,
              data: {
                gigId: listing.gigId,
                listingId: listing.id,
              },
            },
          }),
        ])

        return {
          listingId: listing.id,
          gigId: listing.gigId,
          unfeatured: shouldUnfeature,
        }
      })
    )

    const processed = results.filter((r) => r.status === "fulfilled").length
    const failed = results.filter((r) => r.status === "rejected").length

    return NextResponse.json({
      success: true,
      message: `Processed ${processed} expired listings`,
      processed,
      failed,
      details: results.map((r, i) =>
        r.status === "fulfilled"
          ? r.value
          : { listingId: expiredListings[i].id, error: (r as PromiseRejectedResult).reason?.message }
      ),
    })
  } catch (error) {
    console.error("Expire featured cron error:", error)
    return NextResponse.json(
      { error: "Failed to process expired listings" },
      { status: 500 }
    )
  }
}

// Also support GET for manual triggering in development
export async function GET(request: NextRequest) {
  return POST(request)
}
