"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/hooks/use-auth"
import { solToLamports } from "@/lib/utils"
import type { Category } from "@/types"

const gigSchema = z.object({
  title: z.string().min(10, "Title must be at least 10 characters").max(200),
  description: z.string().min(50, "Description must be at least 50 characters").max(5000),
  categoryId: z.string().min(1, "Please select a category"),
  tags: z.string().optional(),
})

type GigFormData = z.infer<typeof gigSchema>

interface PackageData {
  tier: "BASIC" | "STANDARD" | "PREMIUM"
  name: string
  description: string
  priceSol: string
  deliveryDays: string
  revisions: string
  features: string
}

const defaultPackages: PackageData[] = [
  {
    tier: "BASIC",
    name: "Basic",
    description: "Basic package",
    priceSol: "0.5",
    deliveryDays: "3",
    revisions: "1",
    features: "",
  },
  {
    tier: "STANDARD",
    name: "Standard",
    description: "Standard package with more features",
    priceSol: "1",
    deliveryDays: "2",
    revisions: "2",
    features: "",
  },
  {
    tier: "PREMIUM",
    name: "Premium",
    description: "Premium package with all features",
    priceSol: "2",
    deliveryDays: "1",
    revisions: "3",
    features: "",
  },
]

export default function NewGigPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [packages, setPackages] = useState<PackageData[]>(defaultPackages)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<GigFormData>({
    resolver: zodResolver(gigSchema),
  })

  useEffect(() => {
    async function loadCategories() {
      try {
        const response = await fetch("/api/categories")
        if (response.ok) {
          const data = await response.json()
          setCategories(data.categories)
        }
      } catch (error) {
        console.error("Failed to load categories:", error)
      }
    }

    loadCategories()
  }, [])

  const updatePackage = (index: number, field: keyof PackageData, value: string) => {
    setPackages((prev) =>
      prev.map((pkg, i) => (i === index ? { ...pkg, [field]: value } : pkg))
    )
  }

  const onSubmit = async (data: GigFormData) => {
    if (!user) {
      setError("Please sign in to create a gig")
      return
    }

    // Validate packages
    const validPackages = packages.filter(
      (pkg) =>
        pkg.name.trim() &&
        pkg.description.trim() &&
        parseFloat(pkg.priceSol) > 0 &&
        parseInt(pkg.deliveryDays) > 0
    )

    if (validPackages.length === 0) {
      setError("Please add at least one valid package")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch("/api/gigs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          tags: data.tags?.split(",").map((t) => t.trim()).filter(Boolean) || [],
          packages: validPackages.map((pkg) => ({
            tier: pkg.tier,
            name: pkg.name,
            description: pkg.description,
            priceLamports: solToLamports(parseFloat(pkg.priceSol)).toString(),
            deliveryDays: parseInt(pkg.deliveryDays),
            revisions: parseInt(pkg.revisions) || 1,
            features: pkg.features.split("\n").filter(Boolean),
          })),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create gig")
      }

      const { gig } = await response.json()
      router.push(`/dashboard/gigs`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create gig")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!user) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold">Sign in to create a gig</h1>
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-8">Create New Gig</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Gig Title</Label>
              <Input
                id="title"
                placeholder="I will create an AI-powered solution for..."
                {...register("title")}
                error={!!errors.title}
              />
              {errors.title && (
                <p className="text-sm text-destructive">{errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoryId">Category</Label>
              <Select
                onValueChange={(value) => setValue("categoryId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.categoryId && (
                <p className="text-sm text-destructive">
                  {errors.categoryId.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe your service in detail..."
                rows={8}
                {...register("description")}
                error={!!errors.description}
              />
              {errors.description && (
                <p className="text-sm text-destructive">
                  {errors.description.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                placeholder="AI, automation, chatbot, ..."
                {...register("tags")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Packages */}
        <Card>
          <CardHeader>
            <CardTitle>Pricing Packages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {packages.map((pkg, index) => (
                <div
                  key={pkg.tier}
                  className="border rounded-lg p-4 space-y-4"
                >
                  <div className="text-center">
                    <span className="font-semibold text-lg capitalize">
                      {pkg.tier.toLowerCase()}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Name</Label>
                      <Input
                        value={pkg.name}
                        onChange={(e) =>
                          updatePackage(index, "name", e.target.value)
                        }
                        placeholder="Package name"
                      />
                    </div>

                    <div>
                      <Label className="text-xs">Description</Label>
                      <Textarea
                        value={pkg.description}
                        onChange={(e) =>
                          updatePackage(index, "description", e.target.value)
                        }
                        placeholder="What's included"
                        rows={2}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Price (SOL)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={pkg.priceSol}
                          onChange={(e) =>
                            updatePackage(index, "priceSol", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Days</Label>
                        <Input
                          type="number"
                          value={pkg.deliveryDays}
                          onChange={(e) =>
                            updatePackage(index, "deliveryDays", e.target.value)
                          }
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs">Revisions</Label>
                      <Input
                        type="number"
                        value={pkg.revisions}
                        onChange={(e) =>
                          updatePackage(index, "revisions", e.target.value)
                        }
                      />
                    </div>

                    <div>
                      <Label className="text-xs">Features (one per line)</Label>
                      <Textarea
                        value={pkg.features}
                        onChange={(e) =>
                          updatePackage(index, "features", e.target.value)
                        }
                        placeholder="Feature 1&#10;Feature 2&#10;Feature 3"
                        rows={3}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="p-4 rounded-lg bg-destructive/10 text-destructive">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button type="submit" variant="gradient" loading={isSubmitting}>
            Create Gig
          </Button>
        </div>
      </form>
    </div>
  )
}
