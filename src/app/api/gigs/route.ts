import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import prisma from "@/lib/db"
import { getUserFromRequest } from "@/lib/auth"
import { slugify } from "@/lib/utils"

const createGigSchema = z.object({
  title: z.string().min(10).max(200),
  description: z.string().min(50).max(5000),
  categoryId: z.string(),
  tags: z.array(z.string()).optional(),
  images: z.array(z.string()).optional(),
  packages: z.array(
    z.object({
      tier: z.enum(["BASIC", "STANDARD", "PREMIUM"]),
      name: z.string(),
      description: z.string(),
      priceLamports: z.string().or(z.number()),
      deliveryDays: z.number().min(1),
      revisions: z.number().min(0).optional(),
      features: z.array(z.string()).optional(),
    })
  ).min(1),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const pageSize = parseInt(searchParams.get("pageSize") || "12")
    const category = searchParams.get("category")
    const sellerId = searchParams.get("sellerId")
    const featured = searchParams.get("featured") === "true"
    const status = searchParams.get("status") || "ACTIVE"

    const where = {
      ...(status !== "all" && { status: status as "ACTIVE" | "DRAFT" }),
      ...(category && {
        category: { slug: category },
      }),
      ...(sellerId && { sellerId }),
      ...(featured && { featured: true }),
    }

    const [gigs, total] = await Promise.all([
      prisma.gig.findMany({
        where,
        include: {
          seller: {
            include: { agentProfile: true },
          },
          category: true,
          packages: true,
        },
        orderBy: [
          { featured: "desc" },
          { createdAt: "desc" },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.gig.count({ where }),
    ])

    return NextResponse.json({
      items: gigs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error("Get gigs error:", error)
    return NextResponse.json(
      { error: "Failed to get gigs" },
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
    const validatedData = createGigSchema.parse(body)

    // Generate unique slug
    let slug = slugify(validatedData.title)
    const existingGig = await prisma.gig.findUnique({ where: { slug } })
    if (existingGig) {
      slug = `${slug}-${Date.now().toString(36)}`
    }

    const gig = await prisma.gig.create({
      data: {
        sellerId: user.id,
        title: validatedData.title,
        slug,
        description: validatedData.description,
        categoryId: validatedData.categoryId,
        tags: validatedData.tags || [],
        images: validatedData.images || [],
        status: "DRAFT",
        packages: {
          create: validatedData.packages.map((pkg) => ({
            tier: pkg.tier,
            name: pkg.name,
            description: pkg.description,
            priceLamports: BigInt(pkg.priceLamports),
            deliveryDays: pkg.deliveryDays,
            revisions: pkg.revisions || 1,
            features: pkg.features || [],
          })),
        },
      },
      include: {
        packages: true,
        category: true,
      },
    })

    return NextResponse.json({ gig }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Create gig error:", error)
    return NextResponse.json(
      { error: "Failed to create gig" },
      { status: 500 }
    )
  }
}
