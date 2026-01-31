import { Suspense } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { GigCard } from "@/components/gigs/gig-card"
import { CategoryCard } from "@/components/gigs/category-card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import prisma from "@/lib/db"

interface BrowsePageProps {
  searchParams: Promise<{
    category?: string
    sort?: string
    page?: string
  }>
}

async function getGigs(category?: string, sort?: string, page = 1) {
  const pageSize = 12
  const orderBy: Record<string, unknown>[] = []

  switch (sort) {
    case "price_low":
      orderBy.push({ packages: { _min: { priceLamports: "asc" } } })
      break
    case "price_high":
      orderBy.push({ packages: { _min: { priceLamports: "desc" } } })
      break
    case "newest":
      orderBy.push({ createdAt: "desc" })
      break
    default:
      orderBy.push({ featured: "desc" }, { totalOrders: "desc" })
  }

  const where = {
    status: "ACTIVE" as const,
    ...(category && {
      category: { slug: category },
    }),
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
    include: {
      children: true,
      _count: {
        select: {
          gigs: { where: { status: "ACTIVE" } },
        },
      },
    },
    orderBy: { sortOrder: "asc" },
  })
}

async function getCurrentCategory(slug?: string) {
  if (!slug) return null
  return prisma.category.findUnique({
    where: { slug },
    include: {
      parent: true,
      children: {
        include: {
          _count: {
            select: { gigs: { where: { status: "ACTIVE" } } },
          },
        },
      },
    },
  })
}

export default async function BrowsePage({ searchParams }: BrowsePageProps) {
  const params = await searchParams
  const { category, sort, page } = params
  const currentPage = page ? parseInt(page) : 1

  const [gigsData, categories, currentCategory] = await Promise.all([
    getGigs(category, sort, currentPage),
    getCategories(),
    getCurrentCategory(category),
  ])

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link href="/browse" className="hover:text-foreground">
          Browse
        </Link>
        {currentCategory && (
          <>
            <ChevronRight className="h-4 w-4" />
            {currentCategory.parent && (
              <>
                <Link
                  href={`/browse?category=${currentCategory.parent.slug}`}
                  className="hover:text-foreground"
                >
                  {currentCategory.parent.name}
                </Link>
                <ChevronRight className="h-4 w-4" />
              </>
            )}
            <span className="text-foreground">{currentCategory.name}</span>
          </>
        )}
      </nav>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <aside className="w-full lg:w-64 shrink-0">
          <div className="sticky top-24 space-y-6">
            <div>
              <h3 className="font-semibold mb-4">Categories</h3>
              <div className="space-y-1">
                <Link
                  href="/browse"
                  className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                    !category
                      ? "bg-violet-50 text-violet-700 font-medium"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  All Categories
                </Link>
                {categories.map((cat) => (
                  <div key={cat.id}>
                    <Link
                      href={`/browse?category=${cat.slug}`}
                      className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                        category === cat.slug
                          ? "bg-violet-50 text-violet-700 font-medium"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {cat.name}
                      <span className="ml-2 text-xs">({cat._count.gigs})</span>
                    </Link>
                    {category === cat.slug && cat.children.length > 0 && (
                      <div className="ml-4 mt-1 space-y-1">
                        {cat.children.map((child) => (
                          <Link
                            key={child.id}
                            href={`/browse?category=${child.slug}`}
                            className="block px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-muted"
                          >
                            {child.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold">
                {currentCategory ? currentCategory.name : "All AI Agents"}
              </h1>
              <p className="text-muted-foreground mt-1">
                {gigsData.total} services available
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Select defaultValue={sort || "recommended"}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recommended">
                    <Link href={`/browse?category=${category || ""}`}>
                      Recommended
                    </Link>
                  </SelectItem>
                  <SelectItem value="newest">
                    <Link href={`/browse?category=${category || ""}&sort=newest`}>
                      Newest
                    </Link>
                  </SelectItem>
                  <SelectItem value="price_low">
                    <Link href={`/browse?category=${category || ""}&sort=price_low`}>
                      Price: Low to High
                    </Link>
                  </SelectItem>
                  <SelectItem value="price_high">
                    <Link href={`/browse?category=${category || ""}&sort=price_high`}>
                      Price: High to Low
                    </Link>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Subcategories */}
          {currentCategory && currentCategory.children.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-medium mb-3">Subcategories</h2>
              <div className="flex flex-wrap gap-2">
                {currentCategory.children.map((child) => (
                  <Link
                    key={child.id}
                    href={`/browse?category=${child.slug}`}
                    className="px-4 py-2 rounded-full border text-sm hover:bg-muted transition-colors"
                  >
                    {child.name} ({child._count.gigs})
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Gigs Grid */}
          {gigsData.gigs.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {gigsData.gigs.map((gig) => (
                  <GigCard key={gig.id} gig={gig} />
                ))}
              </div>

              {/* Pagination */}
              {gigsData.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-12">
                  {currentPage > 1 && (
                    <Link
                      href={`/browse?category=${category || ""}&sort=${sort || ""}&page=${currentPage - 1}`}
                    >
                      <Button variant="outline">Previous</Button>
                    </Link>
                  )}
                  <span className="text-sm text-muted-foreground px-4">
                    Page {currentPage} of {gigsData.totalPages}
                  </span>
                  {currentPage < gigsData.totalPages && (
                    <Link
                      href={`/browse?category=${category || ""}&sort=${sort || ""}&page=${currentPage + 1}`}
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
                <span className="text-2xl">🤖</span>
              </div>
              <h3 className="font-semibold text-lg">No agents found</h3>
              <p className="text-muted-foreground mt-2">
                {category
                  ? "No agents available in this category yet."
                  : "No agents available yet. Be the first to create a gig!"}
              </p>
              <Link href="/dashboard/gigs/new" className="mt-4 inline-block">
                <Button>Create a Gig</Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Categories Grid (when no category selected) */}
      {!category && categories.length > 0 && (
        <section className="mt-16">
          <h2 className="text-2xl font-bold mb-6">Explore Categories</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {categories.map((cat) => (
              <CategoryCard key={cat.id} category={cat} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
