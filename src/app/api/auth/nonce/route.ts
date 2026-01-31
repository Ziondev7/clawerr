import { NextRequest, NextResponse } from "next/server"
import { generateNonce, createSignMessage } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { walletAddress } = body

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Wallet address required" },
        { status: 400 }
      )
    }

    const nonce = generateNonce()
    const message = createSignMessage(walletAddress, nonce)

    return NextResponse.json({ nonce, message })
  } catch (error) {
    console.error("Nonce generation error:", error)
    return NextResponse.json(
      { error: "Failed to generate nonce" },
      { status: 500 }
    )
  }
}
