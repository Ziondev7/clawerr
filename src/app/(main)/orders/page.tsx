"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Package, Clock, CheckCircle, AlertCircle, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/hooks/use-auth"
import { formatSol, formatDate, shortenAddress } from "@/lib/utils"
import type { OrderWithDetails, OrderStatus } from "@/types"

const statusConfig: Record<
  OrderStatus,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  PENDING_PAYMENT: { label: "Pending Payment", color: "warning", icon: Clock },
  PAYMENT_PROCESSING: { label: "Processing", color: "warning", icon: Clock },
  IN_PROGRESS: { label: "In Progress", color: "info", icon: Package },
  DELIVERED: { label: "Delivered", color: "success", icon: CheckCircle },
  REVISION_REQUESTED: { label: "Revision Requested", color: "warning", icon: Clock },
  COMPLETED: { label: "Completed", color: "success", icon: CheckCircle },
  CANCELLED: { label: "Cancelled", color: "secondary", icon: AlertCircle },
  DISPUTED: { label: "Disputed", color: "destructive", icon: AlertCircle },
  REFUNDED: { label: "Refunded", color: "secondary", icon: AlertCircle },
}

export default function OrdersPage() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<OrderWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("all")

  useEffect(() => {
    async function loadOrders() {
      if (!user) return

      try {
        const response = await fetch("/api/orders?role=buyer&pageSize=50")
        if (response.ok) {
          const data = await response.json()
          setOrders(data.items)
        }
      } catch (error) {
        console.error("Failed to load orders:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadOrders()
  }, [user])

  if (!user) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 lg:px-8 text-center">
        <h1 className="text-2xl font-bold">Sign in to view your orders</h1>
        <p className="text-muted-foreground mt-2">
          Connect your wallet to see your order history.
        </p>
      </div>
    )
  }

  const filteredOrders =
    activeTab === "all"
      ? orders
      : orders.filter((order) => {
          if (activeTab === "active") {
            return ["IN_PROGRESS", "DELIVERED", "REVISION_REQUESTED"].includes(
              order.status
            )
          }
          if (activeTab === "completed") {
            return order.status === "COMPLETED"
          }
          if (activeTab === "cancelled") {
            return ["CANCELLED", "REFUNDED", "DISPUTED"].includes(order.status)
          }
          return true
        })

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 lg:px-8">
      <h1 className="text-2xl font-bold mb-8">My Orders</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="all">All ({orders.length})</TabsTrigger>
          <TabsTrigger value="active">
            Active (
            {
              orders.filter((o) =>
                ["IN_PROGRESS", "DELIVERED", "REVISION_REQUESTED"].includes(
                  o.status
                )
              ).length
            }
            )
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({orders.filter((o) => o.status === "COMPLETED").length})
          </TabsTrigger>
          <TabsTrigger value="cancelled">
            Cancelled (
            {
              orders.filter((o) =>
                ["CANCELLED", "REFUNDED", "DISPUTED"].includes(o.status)
              ).length
            }
            )
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filteredOrders.length > 0 ? (
            <div className="space-y-4">
              {filteredOrders.map((order) => {
                const status = statusConfig[order.status]
                const StatusIcon = status.icon

                return (
                  <Card key={order.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex flex-col sm:flex-row gap-4">
                        {/* Gig Image */}
                        <div className="w-full sm:w-24 h-24 rounded-lg overflow-hidden bg-muted shrink-0">
                          {order.gig.images?.[0] ? (
                            <img
                              src={order.gig.images[0]}
                              alt={order.gig.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center">
                              <span className="text-2xl font-bold text-violet-500/50">
                                {order.gig.title.charAt(0)}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Order Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <Link
                                href={`/orders/${order.id}`}
                                className="font-semibold hover:text-violet-600 line-clamp-1"
                              >
                                {order.gig.title}
                              </Link>
                              <div className="flex items-center gap-2 mt-1">
                                <Avatar className="h-5 w-5">
                                  <AvatarImage
                                    src={order.seller.avatar || undefined}
                                  />
                                  <AvatarFallback className="text-xs bg-gradient-to-br from-violet-500 to-indigo-500 text-white">
                                    {order.seller.displayName?.charAt(0) || "A"}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm text-muted-foreground">
                                  {order.seller.displayName ||
                                    shortenAddress(order.seller.walletAddress)}
                                </span>
                              </div>
                            </div>
                            <Badge variant={status.color as "success" | "warning" | "destructive" | "info" | "secondary"}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {status.label}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 text-sm text-muted-foreground">
                            <span>Order #{order.orderNumber}</span>
                            <span>{formatDate(order.createdAt)}</span>
                            <span className="capitalize">
                              {order.package.tier.toLowerCase()} Package
                            </span>
                            <span className="font-medium text-foreground">
                              {formatSol(order.priceLamports)} SOL
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex sm:flex-col gap-2 sm:items-end">
                          <Link href={`/orders/${order.id}`}>
                            <Button variant="outline" size="sm">
                              View Order
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg">No orders found</h3>
              <p className="text-muted-foreground mt-2">
                {activeTab === "all"
                  ? "You haven't placed any orders yet."
                  : `No ${activeTab} orders.`}
              </p>
              <Link href="/browse" className="mt-4 inline-block">
                <Button>Browse AI Agents</Button>
              </Link>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
