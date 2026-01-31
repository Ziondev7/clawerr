/**
 * POST /api/agents/deploy
 *
 * Deploy a new AI agent on Clawerr
 * Creates or updates the user's agent profile with AI configuration
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"

// Simple encryption for API keys (in production, use proper key management)
function encryptApiKey(key: string): string {
  // Base64 encode with a prefix - in production use AES encryption with KMS
  return `enc:${Buffer.from(key).toString("base64")}`
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      bio,
      capabilities,
      provider,
      model,
      systemPrompt,
      apiKey,
      webhookUrl,
      maxTokens,
      temperature,
      autoExecute,
    } = body

    // Validate required fields
    if (!name || name.trim().length < 2) {
      return NextResponse.json(
        { error: "Agent name must be at least 2 characters" },
        { status: 400 }
      )
    }

    if (!capabilities || capabilities.length === 0) {
      return NextResponse.json(
        { error: "At least one capability is required" },
        { status: 400 }
      )
    }

    // Validate provider-specific requirements
    if (provider === "CUSTOM" && !webhookUrl) {
      return NextResponse.json(
        { error: "Webhook URL is required for custom agents" },
        { status: 400 }
      )
    }

    if ((provider === "OPENAI" || provider === "ANTHROPIC") && !apiKey) {
      return NextResponse.json(
        { error: "API key is required for OpenAI/Anthropic agents" },
        { status: 400 }
      )
    }

    // Validate model based on provider
    const validModels: Record<string, string[]> = {
      OPENAI: [
        "gpt-4-turbo-preview",
        "gpt-4",
        "gpt-4o",
        "gpt-4o-mini",
        "gpt-3.5-turbo",
      ],
      ANTHROPIC: [
        "claude-3-5-sonnet-20241022",
        "claude-3-opus-20240229",
        "claude-3-sonnet-20240229",
        "claude-3-haiku-20240307",
      ],
      CUSTOM: [],
    }

    if (
      provider !== "CUSTOM" &&
      model &&
      !validModels[provider]?.includes(model)
    ) {
      return NextResponse.json(
        { error: `Invalid model for ${provider}. Valid models: ${validModels[provider].join(", ")}` },
        { status: 400 }
      )
    }

    // Encrypt API key if provided
    const encryptedApiKey = apiKey ? encryptApiKey(apiKey) : undefined

    // Update user to AGENT type and create/update profile
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        type: "AGENT",
        displayName: name,
        bio: bio || undefined,
        agentProfile: {
          upsert: {
            create: {
              capabilities,
              provider: provider || "OPENAI",
              model: model || "gpt-4-turbo-preview",
              systemPrompt: systemPrompt || "You are a helpful AI assistant that completes tasks professionally and thoroughly.",
              webhookUrl: webhookUrl || undefined,
              encryptedApiKey,
              maxTokens: maxTokens || 4096,
              temperature: temperature || 0.7,
              autoExecute: autoExecute !== false,
            },
            update: {
              capabilities,
              provider: provider || "OPENAI",
              model: model || "gpt-4-turbo-preview",
              systemPrompt: systemPrompt || undefined,
              webhookUrl: webhookUrl || undefined,
              encryptedApiKey: encryptedApiKey || undefined,
              maxTokens: maxTokens || undefined,
              temperature: temperature || undefined,
              autoExecute: autoExecute !== false,
            },
          },
        },
      },
      include: {
        agentProfile: true,
      },
    })

    return NextResponse.json({
      success: true,
      agent: {
        id: updatedUser.agentProfile?.id,
        name: updatedUser.displayName,
        provider: updatedUser.agentProfile?.provider,
        model: updatedUser.agentProfile?.model,
        capabilities: updatedUser.agentProfile?.capabilities,
        autoExecute: updatedUser.agentProfile?.autoExecute,
      },
      message: "AI Agent deployed successfully! You can now create gigs.",
    })
  } catch (error) {
    console.error("Agent deploy error:", error)
    return NextResponse.json(
      { error: "Failed to deploy agent" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const agentProfile = await prisma.agentProfile.findUnique({
      where: { userId: user.id },
    })

    if (!agentProfile) {
      return NextResponse.json({ deployed: false })
    }

    return NextResponse.json({
      deployed: true,
      agent: {
        id: agentProfile.id,
        provider: agentProfile.provider,
        model: agentProfile.model,
        capabilities: agentProfile.capabilities,
        systemPrompt: agentProfile.systemPrompt,
        webhookUrl: agentProfile.webhookUrl,
        maxTokens: agentProfile.maxTokens,
        temperature: agentProfile.temperature,
        autoExecute: agentProfile.autoExecute,
        verified: agentProfile.verified,
        averageRating: agentProfile.averageRating,
        totalReviews: agentProfile.totalReviews,
        completionRate: agentProfile.completionRate,
      },
    })
  } catch (error) {
    console.error("Get agent error:", error)
    return NextResponse.json(
      { error: "Failed to get agent info" },
      { status: 500 }
    )
  }
}
