"use client"

import Link from "next/link"
import {
  Bot,
  Code,
  FileText,
  Image,
  MessageSquare,
  Music,
  Search,
  Sparkles,
  TrendingUp,
  Video,
  ArrowUpRight,
} from "lucide-react"
import type { CategoryWithChildren } from "@/types"
import { cn } from "@/lib/utils"

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  code: Code,
  writing: FileText,
  image: Image,
  video: Video,
  music: Music,
  chatbot: MessageSquare,
  search: Search,
  analysis: TrendingUp,
  automation: Bot,
  default: Sparkles,
}

const colorMap: Record<string, string> = {
  code: "from-[#1DBF73] to-[#19A463]",
  writing: "from-[#0D084D] to-[#1A1060]",
  image: "from-[#FFB33E] to-[#FF9500]",
  video: "from-[#1DBF73] to-[#128A52]",
  music: "from-[#1DBF73] to-[#19A463]",
  chatbot: "from-[#0D084D] to-[#1A1060]",
  search: "from-[#FFB33E] to-[#FF9500]",
  analysis: "from-[#1DBF73] to-[#128A52]",
  automation: "from-[#0D084D] to-[#1A1060]",
  default: "from-[#1DBF73] to-[#19A463]",
}

interface CategoryCardProps {
  category: CategoryWithChildren
}

export function CategoryCard({ category }: CategoryCardProps) {
  const IconComponent = iconMap[category.icon || "default"] || iconMap.default
  const gradientColor = colorMap[category.icon || "default"] || colorMap.default
  const gigCount = category._count?.gigs ?? 0

  return (
    <Link href={`/browse/${category.slug}`}>
      <div className="group relative">
        {/* Glow effect on hover */}
        <div className={cn(
          "absolute -inset-px rounded-2xl bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl",
          gradientColor
        )} />

        <div className="relative glass-card rounded-2xl p-6 text-center card-hover overflow-hidden">
          {/* Background gradient on hover */}
          <div className={cn(
            "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-10 transition-opacity duration-500",
            gradientColor
          )} />

          {/* Icon */}
          <div className="relative">
            <div className={cn(
              "mx-auto mb-4 w-16 h-16 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:shadow-xl transition-all duration-300",
              gradientColor
            )}>
              <IconComponent className="h-8 w-8 text-white" />
            </div>
          </div>

          {/* Content */}
          <div className="relative">
            <h3 className="font-bold text-base mb-1 group-hover:text-[#1DBF73] transition-colors flex items-center justify-center gap-1">
              {category.name}
              <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1 group-hover:translate-x-0 -translate-y-1 group-hover:translate-y-0 transition-transform" />
            </h3>
            <p className="text-sm text-muted-foreground">
              {gigCount} {gigCount === 1 ? "agent" : "agents"}
            </p>
          </div>
        </div>
      </div>
    </Link>
  )
}
