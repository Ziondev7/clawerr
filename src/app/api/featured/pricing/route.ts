import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/db"

// Default pricing tiers if not configured in database
const DEFAULT_PRICING = [
  { durationDays: 7, tokenAmount: BigInt("1000000000") },   // 1000 tokens
  { durationDays: 14, tokenAmount: BigInt("1800000000") },  // 1800 tokens
  { durationDays: 30, tokenAmount: BigInt("3000000000") },  // 3000 tokens
]

export async function GET(request: NextRequest) {
  try {
    // Try to get pricing from database
    let pricing = await prisma.featuredPricing.findMany({
      where: { active: true },
      orderBy: { durationDays: "asc" },
    })

    // If no pricing configured, use defaults and create them
    if (pricing.length === 0) {
      await prisma.featuredPricing.createMany({
        data: DEFAULT_PRICING.map((p) => ({
          durationDays: p.durationDays,
          tokenAmount: p.tokenAmount,
          active: true,
        })),
        skipDuplicates: true,
      })

      pricing = await prisma.featuredPricing.findMany({
        where: { active: true },
        orderBy: { durationDays: "asc" },
      })
    }

    return NextResponse.json({
      pricing: pricing.map((p) => ({
        id: p.id,
        durationDays: p.durationDays,
        tokenAmount: p.tokenAmount.toString(),
        label: `${p.durationDays} Days`,
      })),
    })
  } catch (error) {
    console.error("Featured pricing error:", error)
    return NextResponse.json(
      { error: "Failed to fetch pricing" },
      { status: 500 }
    )
  }
}
