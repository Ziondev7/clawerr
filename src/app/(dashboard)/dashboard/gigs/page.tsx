"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Plus, Edit, Trash2, Eye, MoreVertical, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PurchaseFeaturedModal } from "@/components/featured/purchase-featured-modal"
import { useAuth } from "@/hooks/use-auth"
import { formatSol } from "@/lib/utils"
import type { GigWithPackages, GigStatus } from "@/types"

const statusConfig: Record<GigStatus, { label: string; color: string }> = {
  DRAFT: { label: "Draft", color: "secondary" },
  PENDING_REVIEW: { label: "Pending Review", color: "warning" },
  ACTIVE: { label: "Active", color: "success" },
  PAUSED: { label: "Paused", color: "secondary" },
  REJECTED: { label: "Rejected", color: "destructive" },
}

export default function GigsPage() {
  const { user } = useAuth()
  const [gigs, setGigs] = useState<GigWithPackages[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [promoteModalOpen, setPromoteModalOpen] = useState(false)
  const [selectedGigForPromotion, setSelectedGigForPromotion] = useState<{
    id: string
    title: string
  } | null>(null)

  useEffect(() => {
    async function loadGigs() {
      if (!user) return

      try {
        const response = await fetch(
          `/api/gigs?sellerId=${user.id}&status=all`
        )
        if (response.ok) {
          const data = await response.json()
          setGigs(data.items)
        }
      } catch (error) {
        console.error("Failed to load gigs:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadGigs()
  }, [user])

  const handleDelete = async (gigId: string) => {
    if (!confirm("Are you sure you want to delete this gig?")) return

    try {
      const response = await fetch(`/api/gigs/${gigId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setGigs((prev) => prev.filter((g) => g.id !== gigId))
      }
    } catch (error) {
      console.error("Failed to delete gig:", error)
    }
  }

  const handleStatusChange = async (
    gigId: string,
    status: "ACTIVE" | "PAUSED"
  ) => {
    try {
      const response = await fetch(`/api/gigs/${gigId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })

      if (response.ok) {
        const { gig } = await response.json()
        setGigs((prev) => prev.map((g) => (g.id === gigId ? gig : g)))
      }
    } catch (error) {
      console.error("Failed to update gig:", error)
    }
  }

  const handlePromote = (gig: GigWithPackages) => {
    setSelectedGigForPromotion({ id: gig.id, title: gig.title })
    setPromoteModalOpen(true)
  }

  const handlePromoteSuccess = () => {
    // Refresh gigs to show updated featured status
    if (user) {
      fetch(`/api/gigs?sellerId=${user.id}&status=all`)
        .then((res) => res.json())
        .then((data) => setGigs(data.items))
        .catch(console.error)
    }
  }

  if (!user) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold">Sign in to manage your gigs</h1>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">My Gigs</h1>
          <p className="text-muted-foreground">
            Manage your services and pricing
          </p>
        </div>
        <Link href="/dashboard/gigs/new">
          <Button variant="gradient" className="gap-2">
            <Plus className="h-4 w-4" />
            Create New Gig
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : gigs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {gigs.map((gig) => {
            const status = statusConfig[gig.status]
            const basicPackage = gig.packages.find((p) => p.tier === "BASIC")

            return (
              <Card key={gig.id} className="overflow-hidden">
                <div className="aspect-video bg-muted relative">
                  {gig.images[0] ? (
                    <img
                      src={gig.images[0]}
                      alt={gig.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center">
                      <span className="text-4xl font-bold text-violet-500/50">
                        {gig.title.charAt(0)}
                      </span>
                    </div>
                  )}
                  <Badge
                    className="absolute top-2 left-2"
                    variant={status.color as "success" | "warning" | "destructive" | "secondary"}
                  >
                    {status.label}
                  </Badge>
                  {gig.featured && (
                    <Badge
                      className="absolute top-2 right-2 bg-yellow-500/90"
                    >
                      <Zap className="h-3 w-3 mr-1" />
                      Featured
                    </Badge>
                  )}
                </div>

                <CardContent className="p-4">
                  <h3 className="font-semibold line-clamp-2 mb-2">{gig.title}</h3>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      From {basicPackage ? formatSol(basicPackage.priceLamports) : "0"} SOL
                    </span>
                    <span className="text-muted-foreground">
                      {gig.totalOrders} orders
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-4">
                    <div className="flex gap-2">
                      <Link href={`/gig/${gig.slug}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Link href={`/dashboard/gigs/${gig.id}/edit`}>
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {gig.status === "ACTIVE" && !gig.featured && (
                          <DropdownMenuItem
                            onClick={() => handlePromote(gig)}
                          >
                            <Zap className="h-4 w-4 mr-2 text-yellow-500" />
                            Promote Gig
                          </DropdownMenuItem>
                        )}
                        {gig.status === "ACTIVE" ? (
                          <DropdownMenuItem
                            onClick={() => handleStatusChange(gig.id, "PAUSED")}
                          >
                            Pause Gig
                          </DropdownMenuItem>
                        ) : gig.status === "PAUSED" || gig.status === "DRAFT" ? (
                          <DropdownMenuItem
                            onClick={() => handleStatusChange(gig.id, "ACTIVE")}
                          >
                            Activate Gig
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(gig.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Gig
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Plus className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg">No gigs yet</h3>
            <p className="text-muted-foreground mt-2 mb-4">
              Create your first gig to start selling
            </p>
            <Link href="/dashboard/gigs/new">
              <Button>Create Your First Gig</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Promote Modal */}
      {selectedGigForPromotion && (
        <PurchaseFeaturedModal
          open={promoteModalOpen}
          onOpenChange={setPromoteModalOpen}
          gigId={selectedGigForPromotion.id}
          gigTitle={selectedGigForPromotion.title}
          onSuccess={handlePromoteSuccess}
        />
      )}
    </div>
  )
}
