"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  DollarSign,
  Package,
  ShoppingBag,
  Star,
  TrendingUp,
  ArrowRight,
  Clock,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/hooks/use-auth"
import { formatSol, formatDate } from "@/lib/utils"

interface DashboardStats {
  totalEarnings: bigint
  pendingEarnings: bigint
  activeOrders: number
  completedOrders: number
  totalGigs: number
  averageRating: number
}

interface RecentOrder {
  id: string
  orderNumber: string
  gig: { title: string }
  buyer: { displayName: string | null }
  status: string
  priceLamports: bigint
  createdAt: string
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadDashboard() {
      if (!user) return

      try {
        // Load orders as seller
        const ordersResponse = await fetch("/api/orders?role=seller&pageSize=5")
        if (ordersResponse.ok) {
          const ordersData = await ordersResponse.json()
          setRecentOrders(ordersData.items)

          // Calculate stats from orders
          const allOrders = ordersData.items
          const completed = allOrders.filter(
            (o: RecentOrder) => o.status === "COMPLETED"
          )
          const active = allOrders.filter((o: RecentOrder) =>
            ["IN_PROGRESS", "DELIVERED", "REVISION_REQUESTED"].includes(o.status)
          )

          // Calculate total earnings from completed orders
          const totalEarnings = completed.reduce(
            (sum: bigint, o: RecentOrder) => sum + BigInt(o.priceLamports),
            BigInt(0)
          )

          // Calculate pending from active orders
          const pendingEarnings = active.reduce(
            (sum: bigint, o: RecentOrder) => sum + BigInt(o.priceLamports),
            BigInt(0)
          )

          setStats({
            totalEarnings,
            pendingEarnings,
            activeOrders: active.length,
            completedOrders: completed.length,
            totalGigs: 0, // Would need separate API call
            averageRating: 0, // Would come from user profile
          })
        }
      } catch (error) {
        console.error("Failed to load dashboard:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadDashboard()
  }, [user])

  if (!user) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold">Sign in to access your dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Connect your wallet to manage your gigs and orders.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user.displayName || "Seller"}!
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Earnings</p>
                <p className="text-2xl font-bold mt-1">
                  {stats ? formatSol(stats.totalEarnings) : "0.00"} SOL
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold mt-1">
                  {stats ? formatSol(stats.pendingEarnings) : "0.00"} SOL
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                <Clock className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Orders</p>
                <p className="text-2xl font-bold mt-1">
                  {stats?.activeOrders || 0}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <ShoppingBag className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold mt-1">
                  {stats?.completedOrders || 0}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-violet-100 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-violet-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Orders</CardTitle>
          <Link href="/dashboard/orders">
            <Button variant="ghost" size="sm">
              View All
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : recentOrders.length > 0 ? (
            <div className="space-y-4">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div>
                    <p className="font-medium line-clamp-1">{order.gig.title}</p>
                    <p className="text-sm text-muted-foreground">
                      #{order.orderNumber} &middot;{" "}
                      {order.buyer.displayName || "Anonymous"}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant={
                        order.status === "COMPLETED"
                          ? "success"
                          : order.status === "IN_PROGRESS"
                          ? "info"
                          : "secondary"
                      }
                    >
                      {order.status.replace(/_/g, " ")}
                    </Badge>
                    <p className="text-sm font-medium mt-1">
                      {formatSol(order.priceLamports)} SOL
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No orders yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create a gig to start receiving orders
              </p>
              <Link href="/dashboard/gigs/new" className="mt-4 inline-block">
                <Button>Create Your First Gig</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link href="/dashboard/gigs/new">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-violet-500/10 to-indigo-500/10 flex items-center justify-center">
                <Package className="h-6 w-6 text-violet-600" />
              </div>
              <div>
                <p className="font-semibold">Create New Gig</p>
                <p className="text-sm text-muted-foreground">
                  Start selling your services
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/orders">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500/10 to-cyan-500/10 flex items-center justify-center">
                <ShoppingBag className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold">Manage Orders</p>
                <p className="text-sm text-muted-foreground">
                  View and fulfill orders
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/settings">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-amber-500/10 to-orange-500/10 flex items-center justify-center">
                <Star className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="font-semibold">Profile Settings</p>
                <p className="text-sm text-muted-foreground">
                  Update your profile
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
