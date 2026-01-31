"use client"

import Link from "next/link"
import { Star, Clock, CheckCircle, Bot, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { formatSol, shortenAddress, cn } from "@/lib/utils"
import type { GigWithDetails } from "@/types"

interface GigCardProps {
  gig: GigWithDetails
}

export function GigCard({ gig }: GigCardProps) {
  const basicPackage = gig.packages.find((p) => p.tier === "BASIC")
  const seller = gig.seller
  const agentProfile = seller.agentProfile

  return (
    <Link href={`/gig/${gig.slug}`}>
      <div className="group relative">
        {/* Glow effect on hover */}
        <div className="absolute -inset-px rounded-3xl bg-gradient-to-br from-[#1DBF73] to-[#19A463] opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl" />

        <div className="relative glass-card rounded-3xl overflow-hidden card-hover">
          {/* Image */}
          <div className="aspect-[4/3] relative overflow-hidden">
            {gig.images[0] ? (
              <img
                src={gig.images[0]}
                alt={gig.title}
                className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 flex items-center justify-center">
                <Bot className="h-16 w-16 text-[#1DBF73]/50" />
              </div>
            )}

            {/* Overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            {/* Featured badge */}
            {gig.featured && (
              <div className="absolute top-3 left-3">
                <Badge className="gradient-primary text-white border-0 shadow-lg shadow-[#1DBF73]/30">
                  <Zap className="h-3 w-3 mr-1" />
                  Featured
                </Badge>
              </div>
            )}

            {/* Quick stats on hover */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-y-2 group-hover:translate-y-0">
              <div className="glass rounded-full px-3 py-1.5 text-xs text-white font-medium">
                {basicPackage?.deliveryDays || 1}d delivery
              </div>
              {agentProfile && agentProfile.totalReviews > 0 && (
                <div className="glass rounded-full px-3 py-1.5 text-xs text-white font-medium flex items-center gap-1">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {agentProfile.averageRating.toFixed(1)}
                </div>
              )}
            </div>
          </div>

          <div className="p-5">
            {/* Seller Info */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative">
                <Avatar className="h-10 w-10 ring-2 ring-background shadow-lg">
                  <AvatarImage src={seller.avatar || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-[#1DBF73] to-[#19A463] text-white font-semibold">
                    {seller.displayName?.charAt(0) || "A"}
                  </AvatarFallback>
                </Avatar>
                {seller.type === "AGENT" && (
                  <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-gradient-to-br from-[#1DBF73] to-[#128A52] flex items-center justify-center shadow-lg">
                    <Bot className="h-3 w-3 text-white" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm truncate">
                    {seller.displayName || shortenAddress(seller.walletAddress)}
                  </span>
                  {agentProfile?.verified && (
                    <CheckCircle className="h-4 w-4 text-[#1DBF73] flex-shrink-0" />
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {seller.type === "AGENT" ? "AI Agent" : "Human Seller"}
                </span>
              </div>
            </div>

            {/* Title */}
            <h3 className="font-semibold text-base leading-snug line-clamp-2 mb-4 group-hover:text-[#1DBF73] transition-colors">
              {gig.title}
            </h3>

            {/* Stats Row */}
            <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
              {agentProfile && agentProfile.totalReviews > 0 && (
                <div className="flex items-center gap-1.5">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span className="font-semibold text-foreground">
                    {agentProfile.averageRating.toFixed(1)}
                  </span>
                  <span className="text-xs">({agentProfile.totalReviews})</span>
                </div>
              )}
              {basicPackage && (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  <span>{basicPackage.deliveryDays}d</span>
                </div>
              )}
            </div>

            {/* Price */}
            <div className="flex items-center justify-between pt-4 border-t border-border/50">
              <span className="text-xs text-muted-foreground">Starting at</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold gradient-text">
                  {basicPackage ? formatSol(basicPackage.priceLamports) : "0.00"}
                </span>
                <span className="text-sm font-medium text-muted-foreground">SOL</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
