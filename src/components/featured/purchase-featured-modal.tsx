"use client"

import { useState, useEffect } from "react"
import { useWallet, useConnection } from "@solana/wallet-adapter-react"
import { Transaction } from "@solana/web3.js"
import { Zap, Loader2, CheckCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatTokens } from "@/lib/solana/token-client"

interface PricingTier {
  id: string
  durationDays: number
  tokenAmount: string
  label: string
}

interface PurchaseFeaturedModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  gigId: string
  gigTitle: string
  onSuccess?: () => void
}

export function PurchaseFeaturedModal({
  open,
  onOpenChange,
  gigId,
  gigTitle,
  onSuccess,
}: PurchaseFeaturedModalProps) {
  const { connection } = useConnection()
  const { publicKey, connected, signTransaction } = useWallet()

  const [pricing, setPricing] = useState<PricingTier[]>([])
  const [selectedTier, setSelectedTier] = useState<PricingTier | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStep, setProcessingStep] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Fetch pricing tiers
  useEffect(() => {
    if (!open) return

    async function fetchPricing() {
      setIsLoading(true)
      try {
        const response = await fetch("/api/featured/pricing")
        if (response.ok) {
          const data = await response.json()
          setPricing(data.pricing)
          if (data.pricing.length > 0) {
            setSelectedTier(data.pricing[0])
          }
        }
      } catch (err) {
        console.error("Failed to fetch pricing:", err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchPricing()
  }, [open])

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setError(null)
      setSuccess(false)
      setProcessingStep("")
    }
  }, [open])

  const handlePurchase = async () => {
    if (!connected || !publicKey || !signTransaction || !selectedTier) {
      setError("Please connect your wallet")
      return
    }

    setIsProcessing(true)
    setError(null)
    setProcessingStep("Initializing purchase...")

    try {
      // 1. Initialize featured purchase
      const initResponse = await fetch("/api/featured/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gigId,
          durationDays: selectedTier.durationDays,
        }),
      })

      if (!initResponse.ok) {
        const data = await initResponse.json()
        throw new Error(data.error || "Failed to initialize purchase")
      }

      const { listing, transaction: txBase64 } = await initResponse.json()

      // 2. Sign the transaction
      setProcessingStep("Please sign the transaction...")
      const transactionBuffer = Buffer.from(txBase64, "base64")
      const transaction = Transaction.from(transactionBuffer)
      const signedTransaction = await signTransaction(transaction)

      // 3. Send transaction
      setProcessingStep("Sending transaction...")
      const txSignature = await connection.sendRawTransaction(
        signedTransaction.serialize(),
        {
          skipPreflight: false,
          preflightCommitment: "confirmed",
        }
      )

      // 4. Wait for confirmation
      setProcessingStep("Waiting for confirmation...")
      const confirmation = await connection.confirmTransaction(
        txSignature,
        "confirmed"
      )

      if (confirmation.value.err) {
        throw new Error("Transaction failed on-chain")
      }

      // 5. Confirm purchase
      setProcessingStep("Activating featured listing...")
      const confirmResponse = await fetch("/api/featured/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: listing.id,
          txSignature,
        }),
      })

      if (!confirmResponse.ok) {
        const data = await confirmResponse.json()
        throw new Error(data.error || "Failed to confirm purchase")
      }

      setSuccess(true)
      onSuccess?.()

      // Close modal after a short delay
      setTimeout(() => {
        onOpenChange(false)
      }, 2000)
    } catch (err) {
      console.error("Featured purchase error:", err)
      if (err instanceof Error) {
        if (err.message.includes("User rejected")) {
          setError("Transaction was cancelled.")
        } else if (err.message.includes("insufficient")) {
          setError("Insufficient $CLAWERR balance.")
        } else {
          setError(err.message)
        }
      } else {
        setError("Purchase failed. Please try again.")
      }
    } finally {
      setIsProcessing(false)
      setProcessingStep("")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Feature Your Gig
          </DialogTitle>
          <DialogDescription>
            Get more visibility by featuring "{gigTitle}" on the homepage.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-8 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Featured!</h3>
            <p className="text-muted-foreground">
              Your gig is now featured on the homepage.
            </p>
          </div>
        ) : isLoading ? (
          <div className="py-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <p className="text-sm font-medium">Select Duration</p>
              <div className="grid gap-2">
                {pricing.map((tier) => (
                  <Card
                    key={tier.id}
                    onClick={() => !isProcessing && setSelectedTier(tier)}
                    className={cn(
                      "p-4 cursor-pointer transition-all duration-200",
                      selectedTier?.id === tier.id &&
                        "ring-2 ring-primary border-primary",
                      isProcessing && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{tier.label}</p>
                        <p className="text-sm text-muted-foreground">
                          Featured on homepage
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">
                          {formatTokens(BigInt(tier.tokenAmount))}
                        </p>
                        <p className="text-xs text-muted-foreground">$CLAWERR</p>
                      </div>
                    </div>
                    {tier.durationDays === 14 && (
                      <Badge className="mt-2 bg-green-500/10 text-green-500 hover:bg-green-500/20">
                        Most Popular
                      </Badge>
                    )}
                    {tier.durationDays === 30 && (
                      <Badge className="mt-2 bg-violet-500/10 text-violet-500 hover:bg-violet-500/20">
                        Best Value
                      </Badge>
                    )}
                  </Card>
                ))}
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                variant="gradient"
                onClick={handlePurchase}
                disabled={!connected || !selectedTier || isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {processingStep || "Processing..."}
                  </>
                ) : !connected ? (
                  "Connect Wallet"
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    Pay {selectedTier && formatTokens(BigInt(selectedTier.tokenAmount))} $CLAWERR
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default PurchaseFeaturedModal
