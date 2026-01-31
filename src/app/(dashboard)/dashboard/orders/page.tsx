"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  Package,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  Send,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/hooks/use-auth"
import { formatSol, formatDate, shortenAddress } from "@/lib/utils"
import type { OrderWithDetails, OrderStatus } from "@/types"

const statusConfig: Record<
  OrderStatus,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  PENDING_PAYMENT: { label: "Pending", color: "warning", icon: Clock },
  PAYMENT_PROCESSING: { label: "Processing", color: "warning", icon: Clock },
  IN_PROGRESS: { label: "In Progress", color: "info", icon: Package },
  DELIVERED: { label: "Delivered", color: "success", icon: CheckCircle },
  REVISION_REQUESTED: { label: "Revision", color: "warning", icon: Clock },
  COMPLETED: { label: "Completed", color: "success", icon: CheckCircle },
  CANCELLED: { label: "Cancelled", color: "secondary", icon: AlertCircle },
  DISPUTED: { label: "Disputed", color: "destructive", icon: AlertCircle },
  REFUNDED: { label: "Refunded", color: "secondary", icon: AlertCircle },
}

export default function SellerOrdersPage() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<OrderWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("active")
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null)
  const [deliveryMessage, setDeliveryMessage] = useState("")
  const [isDelivering, setIsDelivering] = useState(false)

  useEffect(() => {
    async function loadOrders() {
      if (!user) return

      try {
        const response = await fetch("/api/orders?role=seller&pageSize=50")
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

  const handleDeliver = async () => {
    if (!selectedOrder || !deliveryMessage.trim()) return
    setIsDelivering(true)

    try {
      const response = await fetch(`/api/orders/${selectedOrder.id}/deliver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: deliveryMessage }),
      })

      if (response.ok) {
        const data = await response.json()
        setOrders((prev) =>
          prev.map((o) => (o.id === selectedOrder.id ? data.order : o))
        )
        setSelectedOrder(null)
        setDeliveryMessage("")
      }
    } catch (error) {
      console.error("Failed to deliver:", error)
    } finally {
      setIsDelivering(false)
    }
  }

  if (!user) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold">Sign in to view orders</h1>
      </div>
    )
  }

  const filteredOrders =
    activeTab === "all"
      ? orders
      : orders.filter((order) => {
          if (activeTab === "active") {
            return ["IN_PROGRESS", "REVISION_REQUESTED"].includes(order.status)
          }
          if (activeTab === "delivered") {
            return order.status === "DELIVERED"
          }
          if (activeTab === "completed") {
            return order.status === "COMPLETED"
          }
          return true
        })

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Orders to Fulfill</h1>
        <p className="text-muted-foreground">Manage orders from buyers</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="active">
            Active (
            {
              orders.filter((o) =>
                ["IN_PROGRESS", "REVISION_REQUESTED"].includes(o.status)
              ).length
            }
            )
          </TabsTrigger>
          <TabsTrigger value="delivered">
            Delivered ({orders.filter((o) => o.status === "DELIVERED").length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({orders.filter((o) => o.status === "COMPLETED").length})
          </TabsTrigger>
          <TabsTrigger value="all">All ({orders.length})</TabsTrigger>
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
                const canDeliver = ["IN_PROGRESS", "REVISION_REQUESTED"].includes(
                  order.status
                )

                return (
                  <Card key={order.id}>
                    <CardContent className="p-6">
                      <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h3 className="font-semibold line-clamp-1">
                                {order.gig.title}
                              </h3>
                              <div className="flex items-center gap-2 mt-1">
                                <Avatar className="h-5 w-5">
                                  <AvatarImage
                                    src={order.buyer.avatar || undefined}
                                  />
                                  <AvatarFallback className="text-xs">
                                    {order.buyer.displayName?.charAt(0) || "B"}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm text-muted-foreground">
                                  {order.buyer.displayName || "Anonymous Buyer"}
                                </span>
                              </div>
                            </div>
                            <Badge
                              variant={
                                status.color as
                                  | "success"
                                  | "warning"
                                  | "destructive"
                                  | "info"
                                  | "secondary"
                              }
                            >
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {status.label}
                            </Badge>
                          </div>

                          {order.requirements && (
                            <div className="mt-3 p-3 bg-muted rounded-lg">
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {order.requirements}
                              </p>
                            </div>
                          )}

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 text-sm text-muted-foreground">
                            <span>#{order.orderNumber}</span>
                            <span>{formatDate(order.createdAt)}</span>
                            <span className="capitalize">
                              {order.package.tier.toLowerCase()}
                            </span>
                            <span className="font-medium text-foreground">
                              {formatSol(order.priceLamports)} SOL
                            </span>
                            {order.dueDate && (
                              <span className="text-amber-600">
                                Due: {formatDate(order.dueDate)}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex sm:flex-col gap-2">
                          <Link href={`/orders/${order.id}`}>
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </Link>
                          {canDeliver && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="gradient"
                                  onClick={() => setSelectedOrder(order)}
                                >
                                  <Send className="h-4 w-4 mr-1" />
                                  Deliver
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Deliver Order</DialogTitle>
                                  <DialogDescription>
                                    Submit your work for {order.gig.title}
                                  </DialogDescription>
                                </DialogHeader>
                                <Textarea
                                  placeholder="Describe your delivery and include any relevant details or links..."
                                  value={deliveryMessage}
                                  onChange={(e) =>
                                    setDeliveryMessage(e.target.value)
                                  }
                                  rows={6}
                                />
                                <DialogFooter>
                                  <Button
                                    onClick={handleDeliver}
                                    loading={isDelivering}
                                    disabled={!deliveryMessage.trim()}
                                    variant="gradient"
                                  >
                                    Submit Delivery
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="py-16 text-center">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg">No orders</h3>
                <p className="text-muted-foreground mt-2">
                  {activeTab === "active"
                    ? "You don't have any active orders to fulfill."
                    : `No ${activeTab} orders found.`}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
