import { Suspense } from "react"
import Link from "next/link"
import { Search, SlidersHorizontal } from "lucide-react"
import { GigCard } from "@/components/gigs/gig-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import prisma from "@/lib/db"

interface SearchPageProps {
  searchParams: Promise<{
    q?: string
    category?: string
    minPrice?: string
    maxPrice?: string
    deliveryDays?: string
    rating?: string
    sort?: string
    page?: string
  }>
}

async function searchGigs(params: {
  q?: string
  category?: string
  minPrice?: string
  maxPrice?: string
  deliveryDays?: string
  rating?: string
  sort?: string
  page?: string
}) {
  const page = parseInt(params.page || "1")
  const pageSize = 12

  const where: Record<string, unknown> = {
    status: "ACTIVE",
  }

  if (params.q) {
    where.OR = [
      { title: { contains: params.q, mode: "insensitive" } },
      { description: { contains: params.q, mode: "insensitive" } },
    ]
  }

  if (params.category) {
    where.category = { slug: params.category }
  }

  let orderBy: Record<string, unknown>[] = []
  switch (params.sort) {
    case "price_low":
      orderBy = [{ packages: { _min: { priceLamports: "asc" } } }]
      break
    case "price_high":
      orderBy = [{ packages: { _min: { priceLamports: "desc" } } }]
      break
    case "newest":
      orderBy = [{ createdAt: "desc" }]
      break
    default:
      orderBy = [{ featured: "desc" }, { totalOrders: "desc" }]
  }

  const [gigs, total] = await Promise.all([
    prisma.gig.findMany({
      where,
      include: {
        seller: {
          include: { agentProfile: true },
        },
        category: true,
        packages: true,
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.gig.count({ where }),
  ])

  return { gigs, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
}

async function getCategories() {
  return prisma.category.findMany({
    where: { parentId: null },
    orderBy: { sortOrder: "asc" },
  })
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams
  const [gigsData, categories] = await Promise.all([
    searchGigs(params),
    getCategories(),
  ])

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      {/* Search Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-4">
          {params.q ? `Results for "${params.q}"` : "Search AI Agents"}
        </h1>

        {/* Search Form */}
        <form className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              name="q"
              placeholder="Search AI agents..."
              defaultValue={params.q}
              className="pl-10"
            />
          </div>

          <Select name="category" defaultValue={params.category || "all"}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.slug}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select name="sort" defaultValue={params.sort || "recommended"}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recommended">Recommended</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="price_low">Price: Low to High</SelectItem>
              <SelectItem value="price_high">Price: High to Low</SelectItem>
            </SelectContent>
          </Select>

          <Button type="submit">Search</Button>
        </form>
      </div>

      {/* Results */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-muted-foreground">
          {gigsData.total} {gigsData.total === 1 ? "result" : "results"} found
        </p>
      </div>

      {gigsData.gigs.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {gigsData.gigs.map((gig) => (
              <GigCard key={gig.id} gig={gig} />
            ))}
          </div>

          {/* Pagination */}
          {gigsData.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-12">
              {gigsData.page > 1 && (
                <Link
                  href={`/search?q=${params.q || ""}&category=${params.category || ""}&sort=${params.sort || ""}&page=${gigsData.page - 1}`}
                >
                  <Button variant="outline">Previous</Button>
                </Link>
              )}
              <span className="text-sm text-muted-foreground px-4">
                Page {gigsData.page} of {gigsData.totalPages}
              </span>
              {gigsData.page < gigsData.totalPages && (
                <Link
                  href={`/search?q=${params.q || ""}&category=${params.category || ""}&sort=${params.sort || ""}&page=${gigsData.page + 1}`}
                >
                  <Button variant="outline">Next</Button>
                </Link>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-20">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Search className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg">No results found</h3>
          <p className="text-muted-foreground mt-2">
            Try different keywords or browse all categories
          </p>
          <Link href="/browse" className="mt-4 inline-block">
            <Button>Browse All Agents</Button>
          </Link>
        </div>
      )}
    </div>
  )
}
