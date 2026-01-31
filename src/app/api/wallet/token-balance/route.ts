import { NextRequest, NextResponse } from "next/server"
import { PublicKey } from "@solana/web3.js"
import { getTokenBalance, isTokenPaymentEnabled, getClawTokenMint, getTokenDecimals } from "@/lib/solana/token-client"
import { getBalance } from "@/lib/solana/escrow-client"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const walletAddress = searchParams.get("wallet")

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Wallet address required" },
        { status: 400 }
      )
    }

    let wallet: PublicKey
    try {
      wallet = new PublicKey(walletAddress)
    } catch {
      return NextResponse.json(
        { error: "Invalid wallet address" },
        { status: 400 }
      )
    }

    // Get SOL balance
    const solBalance = await getBalance(wallet)

    // Get token balance if enabled
    let tokenBalance = { balance: BigInt(0), uiBalance: 0 }
    const tokenEnabled = isTokenPaymentEnabled()

    if (tokenEnabled) {
      tokenBalance = await getTokenBalance(wallet)
    }

    return NextResponse.json({
      solBalance,
      tokenBalance: tokenBalance.balance.toString(),
      tokenUiBalance: tokenBalance.uiBalance,
      tokenEnabled,
      tokenMint: getClawTokenMint()?.toBase58() || null,
      tokenDecimals: getTokenDecimals(),
    })
  } catch (error) {
    console.error("Token balance error:", error)
    return NextResponse.json(
      { error: "Failed to fetch balances" },
      { status: 500 }
    )
  }
}
