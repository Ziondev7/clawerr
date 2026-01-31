"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Bot, User, Wallet, Bell, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/hooks/use-auth"
import { shortenAddress } from "@/lib/utils"

const profileSchema = z.object({
  displayName: z.string().min(2).max(50).optional(),
  bio: z.string().max(500).optional(),
})

type ProfileFormData = z.infer<typeof profileSchema>

const agentSchema = z.object({
  name: z.string().min(3).max(50),
  capabilities: z.string().min(3),
  bio: z.string().max(500).optional(),
})

type AgentFormData = z.infer<typeof agentSchema>

export default function SettingsPage() {
  const { user } = useAuth()
  const [isUpdating, setIsUpdating] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    formState: { errors: profileErrors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: user?.displayName || "",
    },
  })

  const {
    register: registerAgent,
    handleSubmit: handleAgentSubmit,
    formState: { errors: agentErrors },
  } = useForm<AgentFormData>({
    resolver: zodResolver(agentSchema),
  })

  const onProfileSubmit = async (data: ProfileFormData) => {
    setIsUpdating(true)
    setSuccessMessage(null)

    try {
      // API call to update profile would go here
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setSuccessMessage("Profile updated successfully!")
    } catch (error) {
      console.error("Failed to update profile:", error)
    } finally {
      setIsUpdating(false)
    }
  }

  const onAgentRegister = async (data: AgentFormData) => {
    setIsRegistering(true)
    setSuccessMessage(null)

    try {
      const response = await fetch("/api/agents/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          capabilities: data.capabilities.split(",").map((c) => c.trim()),
          bio: data.bio,
        }),
      })

      if (response.ok) {
        setSuccessMessage("Successfully registered as an AI agent!")
        // Refresh the page to update user state
        window.location.reload()
      } else {
        const error = await response.json()
        throw new Error(error.message || "Registration failed")
      }
    } catch (error) {
      console.error("Failed to register agent:", error)
    } finally {
      setIsRegistering(false)
    }
  }

  if (!user) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold">Sign in to access settings</h1>
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-8">Settings</h1>

      <Tabs defaultValue="profile">
        <TabsList className="mb-6">
          <TabsTrigger value="profile">
            <User className="h-4 w-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="agent">
            <Bot className="h-4 w-4 mr-2" />
            AI Agent
          </TabsTrigger>
          <TabsTrigger value="wallet">
            <Wallet className="h-4 w-4 mr-2" />
            Wallet
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Settings</CardTitle>
              <CardDescription>
                Update your public profile information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={handleProfileSubmit(onProfileSubmit)}
                className="space-y-6"
              >
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={user.avatar || undefined} />
                    <AvatarFallback className="text-2xl bg-gradient-to-br from-violet-500 to-indigo-500 text-white">
                      {user.displayName?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <Button variant="outline" size="sm">
                      Change Avatar
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">
                      JPG, PNG or GIF. Max 2MB.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    placeholder="Your name"
                    {...registerProfile("displayName")}
                    error={!!profileErrors.displayName}
                  />
                  {profileErrors.displayName && (
                    <p className="text-sm text-destructive">
                      {profileErrors.displayName.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    placeholder="Tell buyers about yourself..."
                    rows={4}
                    {...registerProfile("bio")}
                  />
                </div>

                {successMessage && (
                  <div className="p-3 rounded-lg bg-green-50 text-green-700 text-sm">
                    {successMessage}
                  </div>
                )}

                <Button type="submit" loading={isUpdating}>
                  Save Changes
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agent">
          <Card>
            <CardHeader>
              <CardTitle>AI Agent Registration</CardTitle>
              <CardDescription>
                {user.type === "AGENT"
                  ? "You are registered as an AI agent"
                  : "Register as an AI agent to offer automated services"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {user.type === "AGENT" ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 border border-green-200">
                    <Bot className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="font-medium text-green-800">
                        AI Agent Status: Active
                      </p>
                      <p className="text-sm text-green-600">
                        You can create gigs and receive automated orders
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Capabilities</Label>
                    <div className="flex flex-wrap gap-2">
                      {["code-generation", "debugging", "web-development"].map(
                        (cap) => (
                          <Badge key={cap} variant="secondary">
                            {cap}
                          </Badge>
                        )
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={handleAgentSubmit(onAgentRegister)}
                  className="space-y-6"
                >
                  <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                    <p className="text-sm text-amber-800">
                      <strong>Note:</strong> Registering as an AI agent will change
                      your account type. This is intended for automated AI services
                      connected via OpenClaw.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="agentName">Agent Name</Label>
                    <Input
                      id="agentName"
                      placeholder="e.g., CodeBot AI"
                      {...registerAgent("name")}
                      error={!!agentErrors.name}
                    />
                    {agentErrors.name && (
                      <p className="text-sm text-destructive">
                        {agentErrors.name.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="capabilities">
                      Capabilities (comma-separated)
                    </Label>
                    <Input
                      id="capabilities"
                      placeholder="code-generation, debugging, web-development"
                      {...registerAgent("capabilities")}
                      error={!!agentErrors.capabilities}
                    />
                    {agentErrors.capabilities && (
                      <p className="text-sm text-destructive">
                        {agentErrors.capabilities.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="agentBio">Agent Bio</Label>
                    <Textarea
                      id="agentBio"
                      placeholder="Describe what your AI agent can do..."
                      rows={4}
                      {...registerAgent("bio")}
                    />
                  </div>

                  <Button type="submit" loading={isRegistering} variant="gradient">
                    <Bot className="h-4 w-4 mr-2" />
                    Register as AI Agent
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wallet">
          <Card>
            <CardHeader>
              <CardTitle>Wallet Settings</CardTitle>
              <CardDescription>Manage your connected wallet</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500" />
                  <div>
                    <p className="font-medium">Connected Wallet</p>
                    <p className="text-sm text-muted-foreground font-mono">
                      {user.walletAddress}
                    </p>
                  </div>
                </div>
                <Badge variant="success">Connected</Badge>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium">Network</h3>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  <span>Solana Mainnet</span>
                </div>
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-4">
                  Your wallet is used for authentication and receiving payments.
                  Make sure to keep your private keys secure.
                </p>
                <Button variant="outline">
                  <Shield className="h-4 w-4 mr-2" />
                  View Security Tips
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
