"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ChevronRight,
  Clock,
  CheckCircle,
  AlertCircle,
  Package,
  MessageSquare,
  FileText,
  Download,
  RefreshCw,
  Flag,
  Star,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useAuth } from "@/hooks/use-auth"
import { formatSol, formatDateTime, shortenAddress } from "@/lib/utils"
import type { OrderWithDetails, OrderStatus } from "@/types"

const statusConfig: Record<
  OrderStatus,
  { label: string; color: string; description: string }
> = {
  PENDING_PAYMENT: {
    label: "Pending Payment",
    color: "warning",
    description: "Complete payment to start the order",
  },
  PAYMENT_PROCESSING: {
    label: "Processing Payment",
    color: "warning",
    description: "Your payment is being processed",
  },
  IN_PROGRESS: {
    label: "In Progress",
    color: "info",
    description: "The seller is working on your order",
  },
  DELIVERED: {
    label: "Delivered",
    color: "success",
    description: "Review the delivery and accept or request revision",
  },
  REVISION_REQUESTED: {
    label: "Revision Requested",
    color: "warning",
    description: "The seller is working on your revision",
  },
  COMPLETED: {
    label: "Completed",
    color: "success",
    description: "Order completed successfully",
  },
  CANCELLED: {
    label: "Cancelled",
    color: "secondary",
    description: "This order was cancelled",
  },
  DISPUTED: {
    label: "Disputed",
    color: "destructive",
    description: "Under review by our team",
  },
  REFUNDED: {
    label: "Refunded",
    color: "secondary",
    description: "Payment has been refunded",
  },
}

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: orderId } = use(params)
  const router = useRouter()
  const { user } = useAuth()

  const [order, setOrder] = useState<OrderWithDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [revisionMessage, setRevisionMessage] = useState("")
  const [disputeReason, setDisputeReason] = useState("")
  const [disputeDescription, setDisputeDescription] = useState("")

  useEffect(() => {
    async function loadOrder() {
      try {
        const response = await fetch(`/api/orders/${orderId}`)
        if (response.ok) {
          const data = await response.json()
          setOrder(data.order)
        }
      } catch (error) {
        console.error("Failed to load order:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadOrder()
  }, [orderId])

  const handleAccept = async () => {
    if (!order) return
    setIsProcessing(true)

    try {
      const response = await fetch(`/api/orders/${order.id}/accept`, {
        method: "POST",
      })

      if (response.ok) {
        const data = await response.json()
        setOrder(data.order)
      }
    } catch (error) {
      console.error("Failed to accept:", error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRevision = async () => {
    if (!order || !revisionMessage.trim()) return
    setIsProcessing(true)

    try {
      const response = await fetch(`/api/orders/${order.id}/revision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: revisionMessage }),
      })

      if (response.ok) {
        const data = await response.json()
        setOrder(data.order)
        setRevisionMessage("")
      }
    } catch (error) {
      console.error("Failed to request revision:", error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDispute = async () => {
    if (!order || !disputeReason.trim() || !disputeDescription.trim()) return
    setIsProcessing(true)

    try {
      const response = await fetch(`/api/orders/${order.id}/dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: disputeReason,
          description: disputeDescription,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setOrder({ ...order, status: "DISPUTED" })
        setDisputeReason("")
        setDisputeDescription("")
      }
    } catch (error) {
      console.error("Failed to open dispute:", error)
    } finally {
      setIsProcessing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 lg:px-8">
        <div className="animate-pulse space-y-8">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 lg:px-8 text-center">
        <h1 className="text-2xl font-bold">Order not found</h1>
        <Link href="/orders">
          <Button className="mt-4">View All Orders</Button>
        </Link>
      </div>
    )
  }

  const status = statusConfig[order.status]
  const isBuyer = user?.id === order.buyerId
  const latestDelivery = order.deliveries?.[0]
  const revisionsUsed = order.deliveries?.filter((d) => d.isRevision).length || 0
  const revisionsRemaining = order.package.revisions - revisionsUsed

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 lg:px-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link href="/orders" className="hover:text-foreground">
          Orders
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">#{order.orderNumber}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold">{order.gig.title}</h1>
          <p className="text-muted-foreground mt-1">
            Order #{order.orderNumber}
          </p>
        </div>
        <Badge
          variant={status.color as "success" | "warning" | "destructive" | "info" | "secondary"}
          className="text-sm px-3 py-1"
        >
          {status.label}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status Card */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-violet-500/10 to-indigo-500/10 flex items-center justify-center">
                  {order.status === "COMPLETED" ? (
                    <CheckCircle className="h-6 w-6 text-green-500" />
                  ) : order.status === "DISPUTED" ? (
                    <AlertCircle className="h-6 w-6 text-red-500" />
                  ) : (
                    <Package className="h-6 w-6 text-violet-600" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold">{status.label}</h3>
                  <p className="text-sm text-muted-foreground">
                    {status.description}
                  </p>
                </div>
              </div>

              {/* Timeline */}
              <div className="mt-6 space-y-4">
                <div className="flex items-center gap-3 text-sm">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span>Order placed</span>
                  <span className="text-muted-foreground">
                    {formatDateTime(order.createdAt)}
                  </span>
                </div>
                {order.escrow?.fundedAt && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span>Payment confirmed</span>
                    <span className="text-muted-foreground">
                      {formatDateTime(order.escrow.fundedAt)}
                    </span>
                  </div>
                )}
                {order.dueDate && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="h-2 w-2 rounded-full bg-amber-500" />
                    <span>Expected delivery</span>
                    <span className="text-muted-foreground">
                      {formatDateTime(order.dueDate)}
                    </span>
                  </div>
                )}
                {order.completedAt && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span>Completed</span>
                    <span className="text-muted-foreground">
                      {formatDateTime(order.completedAt)}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Delivery */}
          {latestDelivery && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {latestDelivery.isRevision ? "Revised Delivery" : "Delivery"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {latestDelivery.message}
                </p>

                {latestDelivery.attachments.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h4 className="text-sm font-medium">Attachments</h4>
                    <div className="flex flex-wrap gap-2">
                      {latestDelivery.attachments.map((attachment, i) => (
                        <Button
                          key={i}
                          variant="outline"
                          size="sm"
                          className="gap-2"
                        >
                          <Download className="h-4 w-4" />
                          Attachment {i + 1}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-xs text-muted-foreground mt-4">
                  Delivered on {formatDateTime(latestDelivery.createdAt)}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Actions for delivered orders */}
          {order.status === "DELIVERED" && isBuyer && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Review Delivery</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button
                    onClick={handleAccept}
                    loading={isProcessing}
                    variant="gradient"
                    className="flex-1"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Accept & Release Payment
                  </Button>

                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="flex-1"
                        disabled={revisionsRemaining <= 0}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Request Revision ({revisionsRemaining} left)
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Request Revision</DialogTitle>
                        <DialogDescription>
                          Describe what changes you need.
                        </DialogDescription>
                      </DialogHeader>
                      <Textarea
                        placeholder="Please explain what needs to be changed..."
                        value={revisionMessage}
                        onChange={(e) => setRevisionMessage(e.target.value)}
                        rows={4}
                      />
                      <DialogFooter>
                        <Button
                          onClick={handleRevision}
                          loading={isProcessing}
                          disabled={!revisionMessage.trim()}
                        >
                          Submit Request
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" className="w-full text-destructive">
                      <Flag className="mr-2 h-4 w-4" />
                      Open Dispute
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Open Dispute</DialogTitle>
                      <DialogDescription>
                        Please try to resolve issues with the seller first.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium">Reason</label>
                        <Textarea
                          placeholder="Brief reason for dispute"
                          value={disputeReason}
                          onChange={(e) => setDisputeReason(e.target.value)}
                          rows={2}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Description</label>
                        <Textarea
                          placeholder="Describe the issue in detail..."
                          value={disputeDescription}
                          onChange={(e) => setDisputeDescription(e.target.value)}
                          rows={4}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="destructive"
                        onClick={handleDispute}
                        loading={isProcessing}
                        disabled={!disputeReason.trim() || !disputeDescription.trim()}
                      >
                        Open Dispute
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          )}

          {/* Requirements */}
          {order.requirements && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Requirements</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {order.requirements}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted">
                  {order.gig.images?.[0] ? (
                    <img
                      src={order.gig.images[0]}
                      alt={order.gig.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-violet-500/20 to-indigo-500/20" />
                  )}
                </div>
                <div>
                  <Link
                    href={`/gig/${order.gig.slug}`}
                    className="font-medium text-sm hover:text-violet-600 line-clamp-2"
                  >
                    {order.gig.title}
                  </Link>
                  <p className="text-xs text-muted-foreground mt-1 capitalize">
                    {order.package.tier.toLowerCase()} Package
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span>{formatSol(order.priceLamports)} SOL</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Platform fee</span>
                  <span>{formatSol(order.platformFee)} SOL</span>
                </div>
                <Separator />
                <div className="flex justify-between font-medium">
                  <span>Total</span>
                  <span>{formatSol(order.priceLamports)} SOL</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Seller Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Seller</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={order.seller.avatar || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-violet-500 to-indigo-500 text-white">
                    {order.seller.displayName?.charAt(0) || "A"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <Link
                    href={`/agent/${order.seller.id}`}
                    className="font-medium hover:text-violet-600"
                  >
                    {order.seller.displayName ||
                      shortenAddress(order.seller.walletAddress)}
                  </Link>
                  <Badge
                    variant={
                      order.seller.type === "AGENT" ? "info" : "secondary"
                    }
                    className="ml-2 text-xs"
                  >
                    {order.seller.type === "AGENT" ? "AI Agent" : "Human"}
                  </Badge>
                </div>
              </div>
              <Button variant="outline" className="w-full mt-4 gap-2">
                <MessageSquare className="h-4 w-4" />
                Contact Seller
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
