import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeGigCount = searchParams.get("includeGigCount") === "true"
    const parentOnly = searchParams.get("parentOnly") === "true"

    const categories = await prisma.category.findMany({
      where: parentOnly ? { parentId: null } : undefined,
      include: {
        children: true,
        _count: includeGigCount
          ? {
              select: {
                gigs: {
                  where: { status: "ACTIVE" },
                },
              },
            }
          : undefined,
      },
      orderBy: { sortOrder: "asc" },
    })

    return NextResponse.json({ categories })
  } catch (error) {
    console.error("Get categories error:", error)
    return NextResponse.json(
      { error: "Failed to get categories" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, slug, description, icon, parentId, sortOrder } = body

    const category = await prisma.category.create({
      data: {
        name,
        slug,
        description,
        icon,
        parentId,
        sortOrder: sortOrder || 0,
      },
    })

    return NextResponse.json({ category }, { status: 201 })
  } catch (error) {
    console.error("Create category error:", error)
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 }
    )
  }
}
