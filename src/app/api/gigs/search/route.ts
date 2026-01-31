import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q") || ""
    const category = searchParams.get("category")
    const minPrice = searchParams.get("minPrice")
    const maxPrice = searchParams.get("maxPrice")
    const deliveryDays = searchParams.get("deliveryDays")
    const rating = searchParams.get("rating")
    const sortBy = searchParams.get("sortBy") || "relevance"
    const page = parseInt(searchParams.get("page") || "1")
    const pageSize = parseInt(searchParams.get("pageSize") || "12")

    // Build where clause
    const where: Record<string, unknown> = {
      status: "ACTIVE",
    }

    if (query) {
      where.OR = [
        { title: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
        { tags: { hasSome: query.toLowerCase().split(" ") } },
      ]
    }

    if (category) {
      where.category = { slug: category }
    }

    // Price filter requires checking packages
    let priceFilter: Record<string, unknown> | undefined
    if (minPrice || maxPrice) {
      priceFilter = {
        priceLamports: {
          ...(minPrice && { gte: BigInt(minPrice) }),
          ...(maxPrice && { lte: BigInt(maxPrice) }),
        },
      }
    }

    // Build orderBy
    let orderBy: Record<string, unknown>[] = []
    switch (sortBy) {
      case "price_low":
        orderBy = [{ packages: { _min: { priceLamports: "asc" } } }]
        break
      case "price_high":
        orderBy = [{ packages: { _min: { priceLamports: "desc" } } }]
        break
      case "rating":
        orderBy = [{ seller: { agentProfile: { averageRating: "desc" } } }]
        break
      case "newest":
        orderBy = [{ createdAt: "desc" }]
        break
      default:
        orderBy = [{ featured: "desc" }, { totalOrders: "desc" }]
    }

    const [gigs, total] = await Promise.all([
      prisma.gig.findMany({
        where,
        include: {
          seller: {
            include: { agentProfile: true },
          },
          category: true,
          packages: {
            where: priceFilter,
            orderBy: { tier: "asc" },
          },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.gig.count({ where }),
    ])

    // Filter gigs that have matching packages (for price filter)
    const filteredGigs = priceFilter
      ? gigs.filter((gig) => gig.packages.length > 0)
      : gigs

    // Apply delivery days filter
    let finalGigs = filteredGigs
    if (deliveryDays) {
      finalGigs = filteredGigs.filter((gig) =>
        gig.packages.some((pkg) => pkg.deliveryDays <= parseInt(deliveryDays))
      )
    }

    // Apply rating filter
    if (rating) {
      finalGigs = finalGigs.filter(
        (gig) =>
          gig.seller.agentProfile &&
          gig.seller.agentProfile.averageRating >= parseFloat(rating)
      )
    }

    return NextResponse.json({
      items: finalGigs,
      total: finalGigs.length,
      page,
      pageSize,
      totalPages: Math.ceil(finalGigs.length / pageSize),
      query,
      filters: {
        category,
        minPrice,
        maxPrice,
        deliveryDays,
        rating,
        sortBy,
      },
    })
  } catch (error) {
    console.error("Search gigs error:", error)
    return NextResponse.json(
      { error: "Failed to search gigs" },
      { status: 500 }
    )
  }
}
