import { notFound } from "next/navigation"
import Link from "next/link"
import {
  ChevronRight,
  Star,
  Clock,
  CheckCircle,
  RefreshCw,
  MessageSquare,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { formatSol, shortenAddress, formatDate } from "@/lib/utils"
import prisma from "@/lib/db"

interface GigPageProps {
  params: Promise<{ slug: string }>
}

async function getGig(slug: string) {
  const gig = await prisma.gig.findUnique({
    where: { slug },
    include: {
      seller: {
        include: { agentProfile: true },
      },
      category: {
        include: { parent: true },
      },
      packages: {
        orderBy: { tier: "asc" },
      },
      faqs: {
        orderBy: { sortOrder: "asc" },
      },
    },
  })

  if (!gig) return null

  // Get reviews for this seller
  const reviews = await prisma.review.findMany({
    where: { targetId: gig.sellerId },
    include: {
      author: {
        select: {
          id: true,
          displayName: true,
          avatar: true,
        },
      },
      order: {
        include: {
          gig: {
            select: { title: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  })

  return { gig, reviews }
}

export default async function GigPage({ params }: GigPageProps) {
  const { slug } = await params
  const data = await getGig(slug)

  if (!data) {
    notFound()
  }

  const { gig, reviews } = data
  const seller = gig.seller
  const agentProfile = seller.agentProfile

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
        <ChevronRight className="h-4 w-4" />
        {gig.category.parent && (
          <>
            <Link
              href={`/browse?category=${gig.category.parent.slug}`}
              className="hover:text-foreground"
            >
              {gig.category.parent.name}
            </Link>
            <ChevronRight className="h-4 w-4" />
          </>
        )}
        <Link
          href={`/browse?category=${gig.category.slug}`}
          className="hover:text-foreground"
        >
          {gig.category.name}
        </Link>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold leading-tight">
              {gig.title}
            </h1>

            {/* Seller Info */}
            <div className="flex items-center gap-4 mt-4">
              <Avatar className="h-12 w-12">
                <AvatarImage src={seller.avatar || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-violet-500 to-indigo-500 text-white">
                  {seller.displayName?.charAt(0) || "A"}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/agent/${seller.id}`}
                    className="font-semibold hover:text-violet-600"
                  >
                    {seller.displayName || shortenAddress(seller.walletAddress)}
                  </Link>
                  {agentProfile?.verified && (
                    <CheckCircle className="h-4 w-4 text-blue-500" />
                  )}
                  <Badge
                    variant={seller.type === "AGENT" ? "info" : "secondary"}
                  >
                    {seller.type === "AGENT" ? "AI Agent" : "Human"}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                  {agentProfile && agentProfile.totalReviews > 0 && (
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                      <span className="font-medium text-foreground">
                        {agentProfile.averageRating.toFixed(1)}
                      </span>
                      <span>({agentProfile.totalReviews} reviews)</span>
                    </div>
                  )}
                  <span>{gig.totalOrders} orders completed</span>
                </div>
              </div>
            </div>
          </div>

          {/* Gallery */}
          {gig.images.length > 0 ? (
            <div className="aspect-video rounded-xl overflow-hidden bg-muted">
              <img
                src={gig.images[0]}
                alt={gig.title}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center">
              <span className="text-6xl font-bold text-violet-500/30">
                {gig.title.charAt(0)}
              </span>
            </div>
          )}

          {/* Tabs */}
          <Tabs defaultValue="description" className="w-full">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="description">Description</TabsTrigger>
              <TabsTrigger value="reviews">
                Reviews ({reviews.length})
              </TabsTrigger>
              {gig.faqs.length > 0 && (
                <TabsTrigger value="faq">FAQ</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="description" className="mt-6">
              <div className="prose prose-gray max-w-none">
                <p className="whitespace-pre-wrap text-muted-foreground">
                  {gig.description}
                </p>
              </div>

              {/* Tags */}
              {gig.tags.length > 0 && (
                <div className="mt-8">
                  <h3 className="font-semibold mb-3">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {gig.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Agent Capabilities */}
              {agentProfile && agentProfile.capabilities.length > 0 && (
                <div className="mt-8">
                  <h3 className="font-semibold mb-3">Agent Capabilities</h3>
                  <div className="flex flex-wrap gap-2">
                    {agentProfile.capabilities.map((cap) => (
                      <Badge key={cap} variant="outline">
                        {cap}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="reviews" className="mt-6">
              {reviews.length > 0 ? (
                <div className="space-y-6">
                  {reviews.map((review) => (
                    <div key={review.id} className="border-b pb-6 last:border-0">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={review.author.avatar || undefined} />
                          <AvatarFallback>
                            {review.author.displayName?.charAt(0) || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {review.author.displayName || "Anonymous"}
                            </span>
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                              <span className="text-sm">
                                {review.rating.toFixed(1)}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDate(review.createdAt)}
                          </p>
                          {review.comment && (
                            <p className="mt-3 text-muted-foreground">
                              {review.comment}
                            </p>
                          )}
                          {review.response && (
                            <div className="mt-4 ml-4 pl-4 border-l-2">
                              <p className="text-sm font-medium">
                                Seller Response:
                              </p>
                              <p className="text-sm text-muted-foreground mt-1">
                                {review.response}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No reviews yet</p>
                </div>
              )}
            </TabsContent>

            {gig.faqs.length > 0 && (
              <TabsContent value="faq" className="mt-6">
                <div className="space-y-6">
                  {gig.faqs.map((faq) => (
                    <div key={faq.id}>
                      <h4 className="font-medium">{faq.question}</h4>
                      <p className="mt-2 text-muted-foreground">{faq.answer}</p>
                    </div>
                  ))}
                </div>
              </TabsContent>
            )}
          </Tabs>
        </div>

        {/* Sidebar - Packages */}
        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <Tabs
              defaultValue={gig.packages[0]?.tier || "BASIC"}
              className="w-full"
            >
              <TabsList className="w-full">
                {gig.packages.map((pkg) => (
                  <TabsTrigger
                    key={pkg.id}
                    value={pkg.tier}
                    className="flex-1 capitalize"
                  >
                    {pkg.tier.toLowerCase()}
                  </TabsTrigger>
                ))}
              </TabsList>

              {gig.packages.map((pkg) => (
                <TabsContent key={pkg.id} value={pkg.tier}>
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{pkg.name}</CardTitle>
                        <div className="text-right">
                          <span className="text-2xl font-bold">
                            {formatSol(pkg.priceLamports)}
                          </span>
                          <span className="text-muted-foreground ml-1">
                            SOL
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {pkg.description}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{pkg.deliveryDays} day delivery</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <RefreshCw className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {pkg.revisions}{" "}
                            {pkg.revisions === 1 ? "revision" : "revisions"}
                          </span>
                        </div>
                      </div>

                      <Separator />

                      {pkg.features.length > 0 && (
                        <ul className="space-y-2">
                          {pkg.features.map((feature, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2 text-sm"
                            >
                              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      <Link
                        href={`/checkout/${gig.id}?package=${pkg.tier}`}
                        className="block"
                      >
                        <Button className="w-full" size="lg" variant="gradient">
                          Continue ({formatSol(pkg.priceLamports)} SOL)
                        </Button>
                      </Link>

                      <Button variant="outline" className="w-full gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Contact Seller
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>
              ))}
            </Tabs>

            {/* Seller Card */}
            <Card className="mt-6">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={seller.avatar || undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-violet-500 to-indigo-500 text-white text-xl">
                      {seller.displayName?.charAt(0) || "A"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <Link
                      href={`/agent/${seller.id}`}
                      className="font-semibold hover:text-violet-600"
                    >
                      {seller.displayName ||
                        shortenAddress(seller.walletAddress)}
                    </Link>
                    {seller.bio && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {seller.bio}
                      </p>
                    )}
                  </div>
                </div>

                {agentProfile && (
                  <div className="grid grid-cols-2 gap-4 mt-6 text-center">
                    <div className="p-3 rounded-lg bg-muted">
                      <div className="text-2xl font-bold">
                        {agentProfile.completionRate}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Completion
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-muted">
                      <div className="text-2xl font-bold">
                        {agentProfile.responseTimeHrs}h
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Response Time
                      </div>
                    </div>
                  </div>
                )}

                <Link href={`/agent/${seller.id}`} className="block mt-4">
                  <Button variant="outline" className="w-full">
                    View Profile
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
