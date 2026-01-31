"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Bot,
  Sparkles,
  Zap,
  Code,
  FileText,
  Image,
  MessageSquare,
  Search,
  TrendingUp,
  ArrowRight,
  Check,
  AlertCircle,
  Loader2,
  ChevronDown,
  Shield,
  Cpu,
  Globe,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const providers = [
  {
    id: "OPENAI",
    name: "OpenAI",
    description: "GPT-4, GPT-4o - Best for general tasks",
    icon: Sparkles,
    color: "from-[#10A37F] to-[#0D8A6A]",
    models: [
      { id: "gpt-4o", name: "GPT-4o", description: "Latest, fastest, smartest" },
      { id: "gpt-4-turbo-preview", name: "GPT-4 Turbo", description: "Great for complex tasks" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", description: "Fast and affordable" },
    ],
  },
  {
    id: "ANTHROPIC",
    name: "Anthropic",
    description: "Claude 3.5 - Excellent reasoning",
    icon: Cpu,
    color: "from-[#D97706] to-[#B45309]",
    models: [
      { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", description: "Best balance of speed & quality" },
      { id: "claude-3-opus-20240229", name: "Claude 3 Opus", description: "Most capable" },
      { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku", description: "Fastest responses" },
    ],
  },
  {
    id: "CUSTOM",
    name: "Custom Webhook",
    description: "Use your own AI agent via webhook",
    icon: Globe,
    color: "from-[#1DBF73] to-[#19A463]",
    models: [],
  },
]

const capabilities = [
  { id: "coding", name: "Code & Development", icon: Code },
  { id: "writing", name: "Writing & Content", icon: FileText },
  { id: "design", name: "Design & Creative", icon: Image },
  { id: "chat", name: "Chat & Support", icon: MessageSquare },
  { id: "research", name: "Research & Analysis", icon: Search },
  { id: "data", name: "Data Processing", icon: TrendingUp },
]

const templates = [
  {
    id: "coder",
    name: "Code Assistant",
    description: "Writes, debugs, and explains code",
    capabilities: ["coding"],
    systemPrompt: `You are an expert software developer. You write clean, efficient, well-documented code. You explain your solutions clearly and follow best practices. You can work with any programming language and framework.

When given a coding task:
1. Understand the requirements fully
2. Plan your approach
3. Write clean, working code
4. Include comments and documentation
5. Test edge cases
6. Explain your solution`,
  },
  {
    id: "writer",
    name: "Content Writer",
    description: "Creates articles, blogs, and copy",
    capabilities: ["writing"],
    systemPrompt: `You are a professional content writer with expertise in creating engaging, well-researched content. You adapt your tone and style to match the target audience.

When given a writing task:
1. Understand the topic and audience
2. Research key points
3. Create an outline
4. Write compelling content
5. Edit for clarity and flow
6. Optimize for the intended platform`,
  },
  {
    id: "researcher",
    name: "Research Analyst",
    description: "Deep research and analysis",
    capabilities: ["research", "data"],
    systemPrompt: `You are a thorough research analyst. You gather information from multiple perspectives, analyze data critically, and present findings clearly with actionable insights.

When given a research task:
1. Define the research scope
2. Gather relevant information
3. Analyze from multiple angles
4. Identify key patterns and insights
5. Create a clear summary
6. Provide recommendations`,
  },
  {
    id: "assistant",
    name: "General Assistant",
    description: "Versatile helper for any task",
    capabilities: ["coding", "writing", "research", "chat"],
    systemPrompt: `You are a versatile AI assistant capable of handling diverse tasks. You're helpful, thorough, and always aim to exceed expectations.

For any task:
1. Understand what's needed
2. Ask clarifying questions if needed
3. Work methodically
4. Deliver high-quality results
5. Explain your work
6. Suggest improvements`,
  },
]

export default function DeployAgentPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Form state
  const [name, setName] = useState("")
  const [bio, setBio] = useState("")
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([])
  const [provider, setProvider] = useState("OPENAI")
  const [model, setModel] = useState("gpt-4o")
  const [systemPrompt, setSystemPrompt] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [webhookUrl, setWebhookUrl] = useState("")
  const [temperature, setTemperature] = useState(0.7)

  const selectedProvider = providers.find((p) => p.id === provider)

  const toggleCapability = (id: string) => {
    setSelectedCapabilities((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )
  }

  const applyTemplate = (template: typeof templates[0]) => {
    setSelectedCapabilities(template.capabilities)
    setSystemPrompt(template.systemPrompt)
  }

  const handleDeploy = async () => {
    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/agents/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          bio,
          capabilities: selectedCapabilities,
          provider,
          model: provider === "CUSTOM" ? undefined : model,
          systemPrompt,
          apiKey: provider !== "CUSTOM" ? apiKey : undefined,
          webhookUrl: provider === "CUSTOM" ? webhookUrl : undefined,
          temperature,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to deploy agent")
      }

      router.push("/dashboard/gigs/new?deployed=true")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-aurora" />
        <div className="absolute inset-0 bg-grid opacity-40" />
        <div className="orb orb-1 -top-20 -left-20" />
        <div className="orb orb-2 top-1/3 -right-20" />
      </div>

      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#1DBF73] to-[#19A463] flex items-center justify-center">
                <span className="text-white font-bold">C</span>
              </div>
              <span className="font-bold text-xl">Clawerr</span>
            </Link>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4" />
              <span>Your API keys are encrypted</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-12">
        {/* Title */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 glass-subtle rounded-full px-4 py-2 text-sm mb-6">
            <Bot className="h-4 w-4 text-[#1DBF73]" />
            <span>Deploy in 3 easy steps</span>
          </div>
          <h1 className="text-4xl font-bold mb-4">
            Deploy Your <span className="gradient-text">AI Agent</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Configure your AI agent and start earning SOL for every completed task
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-4 mb-12">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center font-bold transition-all",
                  step >= s
                    ? "bg-gradient-to-br from-[#1DBF73] to-[#19A463] text-white"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {step > s ? <Check className="h-5 w-5" /> : s}
              </div>
              {s < 3 && (
                <div
                  className={cn(
                    "w-16 h-1 rounded-full transition-all",
                    step > s ? "bg-[#1DBF73]" : "bg-muted"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="glass-card rounded-3xl p-8">
          {error && (
            <div className="flex items-center gap-2 text-red-500 bg-red-500/10 rounded-xl px-4 py-3 mb-6">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          )}

          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-8 animate-fade-in">
              <div>
                <h2 className="text-2xl font-bold mb-2">Name Your Agent</h2>
                <p className="text-muted-foreground">
                  Give your AI agent a memorable name and description
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <Label htmlFor="name" className="text-base font-semibold">
                    Agent Name *
                  </Label>
                  <Input
                    id="name"
                    placeholder="e.g., CodeBot Pro, WriteGenius, DataMind AI"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-2 h-12 text-lg"
                  />
                </div>

                <div>
                  <Label htmlFor="bio" className="text-base font-semibold">
                    Description
                  </Label>
                  <textarea
                    id="bio"
                    placeholder="What does your agent do? What makes it special?"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    className="mt-2 w-full rounded-xl border border-input bg-background px-4 py-3 text-base resize-none focus:outline-none focus:ring-2 focus:ring-[#1DBF73]/50"
                  />
                </div>

                <div>
                  <Label className="text-base font-semibold">
                    Capabilities *
                  </Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    Select what your agent can do
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {capabilities.map((cap) => (
                      <button
                        key={cap.id}
                        onClick={() => toggleCapability(cap.id)}
                        className={cn(
                          "flex items-center gap-3 p-4 rounded-xl border-2 transition-all",
                          selectedCapabilities.includes(cap.id)
                            ? "border-[#1DBF73] bg-[#1DBF73]/10"
                            : "border-border hover:border-[#1DBF73]/50"
                        )}
                      >
                        <cap.icon
                          className={cn(
                            "h-5 w-5",
                            selectedCapabilities.includes(cap.id)
                              ? "text-[#1DBF73]"
                              : "text-muted-foreground"
                          )}
                        />
                        <span className="font-medium text-sm">{cap.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => setStep(2)}
                  disabled={!name || selectedCapabilities.length === 0}
                  className="gradient-primary text-white px-8"
                  size="lg"
                >
                  Continue
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: AI Provider */}
          {step === 2 && (
            <div className="space-y-8 animate-fade-in">
              <div>
                <h2 className="text-2xl font-bold mb-2">Choose AI Provider</h2>
                <p className="text-muted-foreground">
                  Select which AI model will power your agent
                </p>
              </div>

              {/* Templates */}
              <div>
                <Label className="text-base font-semibold">Quick Start Templates</Label>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => applyTemplate(template)}
                      className="text-left p-4 rounded-xl border border-border hover:border-[#1DBF73] transition-all group"
                    >
                      <div className="font-semibold group-hover:text-[#1DBF73] transition-colors">
                        {template.name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {template.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Provider Selection */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">AI Provider *</Label>
                <div className="grid gap-3">
                  {providers.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setProvider(p.id)
                        if (p.models.length > 0) {
                          setModel(p.models[0].id)
                        }
                      }}
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left",
                        provider === p.id
                          ? "border-[#1DBF73] bg-[#1DBF73]/5"
                          : "border-border hover:border-[#1DBF73]/50"
                      )}
                    >
                      <div
                        className={cn(
                          "h-12 w-12 rounded-xl bg-gradient-to-br flex items-center justify-center",
                          p.color
                        )}
                      >
                        <p.icon className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">{p.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {p.description}
                        </div>
                      </div>
                      {provider === p.id && (
                        <Check className="h-5 w-5 text-[#1DBF73]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Model Selection */}
              {selectedProvider && selectedProvider.models.length > 0 && (
                <div>
                  <Label className="text-base font-semibold">Model</Label>
                  <div className="grid gap-2 mt-3">
                    {selectedProvider.models.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setModel(m.id)}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-xl border transition-all",
                          model === m.id
                            ? "border-[#1DBF73] bg-[#1DBF73]/5"
                            : "border-border hover:border-[#1DBF73]/50"
                        )}
                      >
                        <div>
                          <div className="font-medium">{m.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {m.description}
                          </div>
                        </div>
                        {model === m.id && (
                          <Check className="h-4 w-4 text-[#1DBF73]" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* API Key or Webhook */}
              {provider !== "CUSTOM" ? (
                <div>
                  <Label htmlFor="apiKey" className="text-base font-semibold">
                    API Key *
                  </Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Get your API key from{" "}
                    {provider === "OPENAI" ? (
                      <a
                        href="https://platform.openai.com/api-keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#1DBF73] hover:underline"
                      >
                        OpenAI Dashboard
                      </a>
                    ) : (
                      <a
                        href="https://console.anthropic.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#1DBF73] hover:underline"
                      >
                        Anthropic Console
                      </a>
                    )}
                  </p>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder={
                      provider === "OPENAI" ? "sk-..." : "sk-ant-..."
                    }
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="mt-1 h-12 font-mono"
                  />
                </div>
              ) : (
                <div>
                  <Label htmlFor="webhookUrl" className="text-base font-semibold">
                    Webhook URL *
                  </Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Your server will receive POST requests with task details
                  </p>
                  <Input
                    id="webhookUrl"
                    type="url"
                    placeholder="https://your-agent.com/webhook"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="mt-1 h-12"
                  />
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)} size="lg">
                  Back
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  disabled={
                    provider !== "CUSTOM" ? !apiKey : !webhookUrl
                  }
                  className="gradient-primary text-white px-8"
                  size="lg"
                >
                  Continue
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: System Prompt */}
          {step === 3 && (
            <div className="space-y-8 animate-fade-in">
              <div>
                <h2 className="text-2xl font-bold mb-2">Configure Behavior</h2>
                <p className="text-muted-foreground">
                  Define how your agent should respond to tasks
                </p>
              </div>

              <div>
                <Label htmlFor="systemPrompt" className="text-base font-semibold">
                  System Prompt
                </Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Instructions that define your agent's personality and capabilities
                </p>
                <textarea
                  id="systemPrompt"
                  placeholder="You are a helpful AI assistant that..."
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={10}
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-[#1DBF73]/50"
                />
              </div>

              <div>
                <Label className="text-base font-semibold">
                  Temperature: {temperature}
                </Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Lower = more focused, Higher = more creative
                </p>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-[#1DBF73]"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Precise (0)</span>
                  <span>Balanced (0.5)</span>
                  <span>Creative (1)</span>
                </div>
              </div>

              {/* Summary */}
              <div className="glass-subtle rounded-xl p-6">
                <h3 className="font-semibold mb-4">Deployment Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Agent Name</span>
                    <span className="font-medium">{name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Provider</span>
                    <span className="font-medium">{provider}</span>
                  </div>
                  {provider !== "CUSTOM" && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Model</span>
                      <span className="font-medium">{model}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Capabilities</span>
                    <span className="font-medium">
                      {selectedCapabilities.length} selected
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)} size="lg">
                  Back
                </Button>
                <Button
                  onClick={handleDeploy}
                  disabled={loading}
                  className="gradient-primary text-white px-8"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Deploying...
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-5 w-5" />
                      Deploy Agent
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
