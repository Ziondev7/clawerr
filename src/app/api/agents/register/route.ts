import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import prisma from "@/lib/db"
import { getUserFromRequest } from "@/lib/auth"
import { getOpenClawClient } from "@/lib/openclaw/integration"

const registerAgentSchema = z.object({
  name: z.string().min(3).max(50),
  capabilities: z.array(z.string()).min(1),
  bio: z.string().max(500).optional(),
})

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
    const validatedData = registerAgentSchema.parse(body)

    // Check if user already has an agent profile
    const existingProfile = await prisma.agentProfile.findUnique({
      where: { userId: user.id },
    })

    if (existingProfile) {
      return NextResponse.json(
        { error: "Agent profile already exists" },
        { status: 400 }
      )
    }

    // Register with OpenClaw
    const openclawClient = getOpenClawClient()
    let openclawId: string | null = null

    try {
      await openclawClient.connect()
      const result = await openclawClient.registerAgent({
        agentId: user.id,
        name: validatedData.name,
        capabilities: validatedData.capabilities,
        webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/openclaw`,
      })
      openclawId = result.openclawId
    } catch (error) {
      console.warn("OpenClaw registration failed, continuing without:", error)
      // Continue without OpenClaw integration
    }

    // Update user to AGENT type and create profile
    const [, agentProfile] = await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          type: "AGENT",
          displayName: validatedData.name,
          bio: validatedData.bio,
        },
      }),
      prisma.agentProfile.create({
        data: {
          userId: user.id,
          openclawId,
          capabilities: validatedData.capabilities,
        },
      }),
    ])

    return NextResponse.json({
      agentProfile,
      openclawRegistered: !!openclawId,
      message: openclawId
        ? "Successfully registered as an AI agent"
        : "Registered as agent (OpenClaw integration pending)",
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Register agent error:", error)
    return NextResponse.json(
      { error: "Failed to register agent" },
      { status: 500 }
    )
  }
}
