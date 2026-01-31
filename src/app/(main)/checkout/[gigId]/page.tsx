"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useWallet, useConnection } from "@solana/wallet-adapter-react"
import { Transaction } from "@solana/web3.js"
import { ChevronRight, Clock, RefreshCw, CheckCircle, Wallet, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { PaymentMethodSelector, type PaymentMethod } from "@/components/checkout/payment-method-selector"
import { useAuth } from "@/hooks/use-auth"
import { formatSol, shortenAddress, lamportsToSol } from "@/lib/utils"
import { formatTokens } from "@/lib/solana/token-client"
import type { GigWithDetails, GigPackage } from "@/types"

interface CheckoutPageProps {
  params: Promise<{ gigId: string }>
  searchParams: Promise<{ package?: string }>
}

export default function CheckoutPage({ params, searchParams }: CheckoutPageProps) {
  const router = useRouter()
  const { connection } = useConnection()
  const { publicKey, connected, signTransaction } = useWallet()
  const { user } = useAuth()

  const [gig, setGig] = useState<GigWithDetails | null>(null)
  const [selectedPackage, setSelectedPackage] = useState<GigPackage | null>(null)
  const [requirements, setRequirements] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStep, setProcessingStep] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("SOL")
  const [solBalance, setSolBalance] = useState(0)
  const [tokenBalance, setTokenBalance] = useState(0)
  const [tokenEnabled, setTokenEnabled] = useState(false)
  const [tokenPrice, setTokenPrice] = useState<bigint>(BigInt(0))

  // Load gig data
  useEffect(() => {
    async function loadGig() {
      const { gigId } = await params
      const { package: packageTier } = await searchParams

      try {
        const response = await fetch(`/api/gigs/${gigId}`)
        if (!response.ok) throw new Error("Failed to load gig")
        const data = await response.json()

        setGig(data.gig)

        // Select the requested package or default to BASIC
        const tier = packageTier || "BASIC"
        const pkg = data.gig.packages.find(
          (p: GigPackage) => p.tier === tier
        )
        setSelectedPackage(pkg || data.gig.packages[0])
      } catch (err) {
        setError("Failed to load gig details")
      } finally {
        setIsLoading(false)
      }
    }

    loadGig()
  }, [params, searchParams])

  // Fetch wallet balances
  const fetchBalances = useCallback(async () => {
    if (!publicKey) return

    try {
      const response = await fetch(`/api/wallet/token-balance?wallet=${publicKey.toBase58()}`)
      if (response.ok) {
        const data = await response.json()
        setSolBalance(data.solBalance)
        setTokenBalance(data.tokenUiBalance)
        setTokenEnabled(data.tokenEnabled)
      }
    } catch (err) {
      console.error("Failed to fetch balances:", err)
    }
  }, [publicKey])

  useEffect(() => {
    if (connected && publicKey) {
      fetchBalances()
    }
  }, [connected, publicKey, fetchBalances])

  // Calculate token price (simple 1:1 ratio for now - can be adjusted via API)
  useEffect(() => {
    if (selectedPackage) {
      // Convert lamports to tokens (assuming 1 SOL = 1000 $CLAWERR for demo)
      // In production, this should be fetched from an oracle or price API
      const solAmount = Number(selectedPackage.priceLamports) / 1e9
      const tokens = BigInt(Math.floor(solAmount * 1000 * 1e6)) // 1000 tokens per SOL, 6 decimals
      setTokenPrice(tokens)
    }
  }, [selectedPackage])

  const handleCheckout = async () => {
    if (!connected || !publicKey || !signTransaction) {
      setError("Please connect your wallet")
      return
    }

    if (!user) {
      setError("Please sign in to continue")
      return
    }

    if (!gig || !selectedPackage) {
      setError("Invalid gig or package")
      return
    }

    setIsProcessing(true)
    setProcessingStep("Creating order...")
    setError(null)

    try {
      // 1. Create order
      const orderResponse = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gigId: gig.id,
          packageTier: selectedPackage.tier,
          requirements,
        }),
      })

      if (!orderResponse.ok) {
        const data = await orderResponse.json()
        throw new Error(data.error || "Failed to create order")
      }

      const { order } = await orderResponse.json()

      // 2. Initialize escrow with payment method
      setProcessingStep("Initializing escrow...")
      const escrowResponse = await fetch("/api/escrow/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          paymentMethod,
          priceTokens: paymentMethod === "CLAWERR" ? tokenPrice.toString() : undefined,
        }),
      })

      if (!escrowResponse.ok) {
        const data = await escrowResponse.json()
        throw new Error(data.error || "Failed to initialize escrow")
      }

      const { transaction: txBase64 } = await escrowResponse.json()

      // 3. Deserialize, sign, and send the transaction
      setProcessingStep("Please sign the transaction in your wallet...")
      const transactionBuffer = Buffer.from(txBase64, "base64")
      const transaction = Transaction.from(transactionBuffer)

      // Sign the transaction with the user's wallet
      const signedTransaction = await signTransaction(transaction)

      // Send the signed transaction to the Solana network
      setProcessingStep("Sending transaction to Solana...")
      const txSignature = await connection.sendRawTransaction(
        signedTransaction.serialize(),
        {
          skipPreflight: false,
          preflightCommitment: "confirmed",
        }
      )

      // Wait for confirmation
      setProcessingStep("Waiting for confirmation...")
      const confirmation = await connection.confirmTransaction(
        txSignature,
        "confirmed"
      )

      if (confirmation.value.err) {
        throw new Error("Transaction failed on-chain")
      }

      // 4. Confirm payment with real signature
      setProcessingStep("Finalizing order...")
      const confirmResponse = await fetch("/api/escrow/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          txSignature,
        }),
      })

      if (!confirmResponse.ok) {
        const data = await confirmResponse.json()
        throw new Error(data.error || "Failed to confirm payment")
      }

      // Redirect to order page
      router.push(`/orders/${order.id}`)
    } catch (err) {
      console.error("Checkout error:", err)
      // Provide user-friendly error messages
      if (err instanceof Error) {
        if (err.message.includes("User rejected")) {
          setError("Transaction was cancelled. Please try again.")
        } else if (err.message.includes("insufficient")) {
          setError(
            paymentMethod === "CLAWERR"
              ? "Insufficient $CLAWERR balance. Please add tokens to your wallet."
              : "Insufficient SOL balance. Please add funds to your wallet."
          )
        } else {
          setError(err.message)
        }
      } else {
        setError("Checkout failed. Please try again.")
      }
    } finally {
      setIsProcessing(false)
      setProcessingStep("")
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 lg:px-8">
        <div className="animate-pulse space-y-8">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-64 bg-muted rounded" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    )
  }

  if (!gig || !selectedPackage) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 lg:px-8 text-center">
        <h1 className="text-2xl font-bold">Gig not found</h1>
        <p className="text-muted-foreground mt-2">
          The gig you're looking for doesn't exist.
        </p>
        <Link href="/browse">
          <Button className="mt-4">Browse Gigs</Button>
        </Link>
      </div>
    )
  }

  const seller = gig.seller
  const platformFee = (Number(selectedPackage.priceLamports) * 10) / 100
  const total = selectedPackage.priceLamports

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 lg:px-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link href={`/gig/${gig.slug}`} className="hover:text-foreground">
          {gig.title}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">Checkout</span>
      </nav>

      <h1 className="text-2xl font-bold mb-8">Complete Your Order</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Gig Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Order Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <div className="w-24 h-24 rounded-lg overflow-hidden bg-muted shrink-0">
                  {gig.images[0] ? (
                    <img
                      src={gig.images[0]}
                      alt={gig.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center">
                      <span className="text-2xl font-bold text-violet-500/50">
                        {gig.title.charAt(0)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <Link
                    href={`/gig/${gig.slug}`}
                    className="font-semibold hover:text-violet-600"
                  >
                    {gig.title}
                  </Link>
                  <div className="flex items-center gap-2 mt-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={seller.avatar || undefined} />
                      <AvatarFallback className="text-xs bg-gradient-to-br from-violet-500 to-indigo-500 text-white">
                        {seller.displayName?.charAt(0) || "A"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-muted-foreground">
                      {seller.displayName ||
                        shortenAddress(seller.walletAddress)}
                    </span>
                    <Badge
                      variant={seller.type === "AGENT" ? "info" : "secondary"}
                      className="text-xs"
                    >
                      {seller.type === "AGENT" ? "AI Agent" : "Human"}
                    </Badge>
                  </div>
                </div>
              </div>

              <Separator className="my-4" />

              {/* Selected Package */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium capitalize">
                    {selectedPackage.tier.toLowerCase()} Package
                  </span>
                  <span className="font-semibold">
                    {formatSol(selectedPackage.priceLamports)} SOL
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {selectedPackage.description}
                </p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{selectedPackage.deliveryDays} day delivery</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <RefreshCw className="h-4 w-4" />
                    <span>{selectedPackage.revisions} revisions</span>
                  </div>
                </div>
                {selectedPackage.features.length > 0 && (
                  <ul className="space-y-1 mt-2">
                    {selectedPackage.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Requirements */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Project Requirements</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="requirements">
                  Describe what you need (optional)
                </Label>
                <Textarea
                  id="requirements"
                  placeholder="Provide details about your project, any specific requirements, preferences, or examples..."
                  rows={6}
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  The more details you provide, the better the result will be.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Payment */}
        <div className="lg:col-span-1">
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle className="text-lg">Payment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Payment Method Selector */}
              {connected && (
                <PaymentMethodSelector
                  selected={paymentMethod}
                  onSelect={setPaymentMethod}
                  solPrice={selectedPackage.priceLamports}
                  tokenPrice={tokenPrice}
                  solBalance={solBalance}
                  tokenBalance={tokenBalance}
                  tokenEnabled={tokenEnabled}
                />
              )}

              <Separator />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>
                    {paymentMethod === "SOL"
                      ? `${formatSol(selectedPackage.priceLamports)} SOL`
                      : `${formatTokens(tokenPrice)} $CLAWERR`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Platform fee (10%)</span>
                  <span>
                    {paymentMethod === "SOL"
                      ? `${formatSol(platformFee)} SOL`
                      : `${formatTokens(BigInt(Math.floor(Number(tokenPrice) * 0.1)))} $CLAWERR`}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold text-base">
                  <span>Total</span>
                  <span>
                    {paymentMethod === "SOL"
                      ? `${formatSol(total)} SOL`
                      : `${formatTokens(tokenPrice)} $CLAWERR`}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted text-sm">
                <p className="font-medium mb-1">Secure Escrow Protection</p>
                <p className="text-muted-foreground text-xs">
                  Your payment is held securely until you approve the delivery.
                </p>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  {error}
                </div>
              )}

              {!connected ? (
                <Button className="w-full" size="lg" variant="gradient" disabled>
                  <Wallet className="mr-2 h-4 w-4" />
                  Connect Wallet to Pay
                </Button>
              ) : !user ? (
                <Button className="w-full" size="lg" variant="gradient" disabled>
                  Sign In to Continue
                </Button>
              ) : (
                <Button
                  className="w-full"
                  size="lg"
                  variant="gradient"
                  onClick={handleCheckout}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {processingStep || "Processing..."}
                    </>
                  ) : paymentMethod === "SOL" ? (
                    `Pay ${formatSol(total)} SOL`
                  ) : (
                    `Pay ${formatTokens(tokenPrice)} $CLAWERR`
                  )}
                </Button>
              )}

              <p className="text-xs text-center text-muted-foreground">
                By clicking "Pay", you agree to our Terms of Service
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
