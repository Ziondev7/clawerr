"use client"

import { useCallback, useState } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import { useWalletModal } from "@solana/wallet-adapter-react-ui"
import bs58 from "bs58"
import { Button } from "@/components/ui/button"
import { shortenAddress } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LogOut, Wallet, Copy, ExternalLink, User } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"

export function WalletConnectButton() {
  const { publicKey, disconnect, signMessage, connected } = useWallet()
  const { setVisible } = useWalletModal()
  const { user, login, logout, isLoading } = useAuth()
  const [isAuthenticating, setIsAuthenticating] = useState(false)

  const handleConnect = useCallback(() => {
    setVisible(true)
  }, [setVisible])

  const handleAuthenticate = useCallback(async () => {
    if (!publicKey || !signMessage) return

    setIsAuthenticating(true)
    try {
      // Get nonce from server
      const nonceResponse = await fetch("/api/auth/nonce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: publicKey.toBase58() }),
      })
      const { nonce, message } = await nonceResponse.json()

      // Sign message
      const encodedMessage = new TextEncoder().encode(message)
      const signature = await signMessage(encodedMessage)
      const signatureBase58 = bs58.encode(signature)

      // Authenticate with server
      await login(publicKey.toBase58(), signatureBase58, message)
    } catch (error) {
      console.error("Authentication failed:", error)
    } finally {
      setIsAuthenticating(false)
    }
  }, [publicKey, signMessage, login])

  const handleDisconnect = useCallback(async () => {
    await logout()
    disconnect()
  }, [logout, disconnect])

  const handleCopyAddress = useCallback(() => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey.toBase58())
    }
  }, [publicKey])

  const handleViewExplorer = useCallback(() => {
    if (publicKey) {
      const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet"
      const explorerUrl = `https://explorer.solana.com/address/${publicKey.toBase58()}?cluster=${network}`
      window.open(explorerUrl, "_blank")
    }
  }, [publicKey])

  // Not connected to wallet
  if (!connected) {
    return (
      <Button onClick={handleConnect} variant="gradient" className="gap-2">
        <Wallet className="h-4 w-4" />
        Connect Wallet
      </Button>
    )
  }

  // Connected but not authenticated
  if (!user) {
    return (
      <Button
        onClick={handleAuthenticate}
        loading={isAuthenticating || isLoading}
        variant="gradient"
        className="gap-2"
      >
        <Wallet className="h-4 w-4" />
        Sign In
      </Button>
    )
  }

  // Fully authenticated
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <div className="h-6 w-6 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500" />
          <span className="hidden sm:inline">
            {user.displayName || shortenAddress(publicKey!.toBase58())}
          </span>
          <span className="sm:hidden">
            {shortenAddress(publicKey!.toBase58(), 2)}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium">
            {user.displayName || "Anonymous"}
          </p>
          <p className="text-xs text-muted-foreground">
            {shortenAddress(publicKey!.toBase58())}
          </p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => window.location.href = "/dashboard"}>
          <User className="mr-2 h-4 w-4" />
          Dashboard
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyAddress}>
          <Copy className="mr-2 h-4 w-4" />
          Copy Address
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleViewExplorer}>
          <ExternalLink className="mr-2 h-4 w-4" />
          View on Explorer
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleDisconnect}
          className="text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
