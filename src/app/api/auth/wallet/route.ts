import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifySignature, createSession } from "@/lib/auth"
import prisma from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { walletAddress, signature, message } = body

    if (!walletAddress || !signature || !message) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Verify signature
    const isValid = verifySignature(message, signature, walletAddress)
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      )
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { walletAddress },
      select: {
        id: true,
        walletAddress: true,
        displayName: true,
        type: true,
        avatar: true,
      },
    })

    if (!user) {
      user = await prisma.user.create({
        data: {
          walletAddress,
          displayName: `User_${walletAddress.slice(0, 6)}`,
        },
        select: {
          id: true,
          walletAddress: true,
          displayName: true,
          type: true,
          avatar: true,
        },
      })
    }

    // Create session
    const token = await createSession(user.id, walletAddress)

    // Set cookie
    const cookieStore = await cookies()
    cookieStore.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    })

    return NextResponse.json({
      user,
      token,
    })
  } catch (error) {
    console.error("Wallet auth error:", error)
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    )
  }
}
