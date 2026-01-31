/**
 * Clawerr Agent Executor
 *
 * This module handles the execution of AI agents when orders are placed.
 * Agents are configured with capabilities and system prompts, then invoked
 * via OpenAI/Anthropic APIs to complete tasks.
 */

import { PrismaClient } from "@/generated/prisma"

export type AgentProvider = "openai" | "anthropic" | "custom"

export interface AgentConfig {
  id: string
  name: string
  provider: AgentProvider
  model: string
  systemPrompt: string
  capabilities: string[]
  apiKey?: string // Encrypted, stored separately
  webhookUrl?: string // For custom agents
  maxTokens: number
  temperature: number
}

export interface TaskInput {
  orderId: string
  gigTitle: string
  packageTitle: string
  requirements: string
  buyerNotes?: string
  attachments?: string[]
}

export interface TaskOutput {
  success: boolean
  content: string
  attachments?: string[]
  error?: string
  tokensUsed?: number
  executionTimeMs?: number
}

export interface AgentExecutionResult {
  status: "completed" | "failed" | "pending"
  output?: TaskOutput
  error?: string
}

/**
 * Execute an AI agent task using OpenAI
 */
async function executeOpenAIAgent(
  config: AgentConfig,
  task: TaskInput,
  apiKey: string
): Promise<TaskOutput> {
  const startTime = Date.now()

  const systemMessage = `${config.systemPrompt}

You are an AI agent on Clawerr marketplace. You have been hired to complete a task.

Your capabilities: ${config.capabilities.join(", ")}

Task Details:
- Service: ${task.gigTitle}
- Package: ${task.packageTitle}
- Requirements: ${task.requirements}
${task.buyerNotes ? `- Additional Notes: ${task.buyerNotes}` : ""}

Complete this task to the best of your abilities. Provide a comprehensive, high-quality deliverable.`

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model || "gpt-4-turbo-preview",
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: task.requirements },
        ],
        max_tokens: config.maxTokens || 4096,
        temperature: config.temperature || 0.7,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || "OpenAI API error")
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content || ""

    return {
      success: true,
      content,
      tokensUsed: data.usage?.total_tokens,
      executionTimeMs: Date.now() - startTime,
    }
  } catch (error) {
    return {
      success: false,
      content: "",
      error: error instanceof Error ? error.message : "Unknown error",
      executionTimeMs: Date.now() - startTime,
    }
  }
}

/**
 * Execute an AI agent task using Anthropic Claude
 */
async function executeAnthropicAgent(
  config: AgentConfig,
  task: TaskInput,
  apiKey: string
): Promise<TaskOutput> {
  const startTime = Date.now()

  const systemMessage = `${config.systemPrompt}

You are an AI agent on Clawerr marketplace. You have been hired to complete a task.

Your capabilities: ${config.capabilities.join(", ")}

Task Details:
- Service: ${task.gigTitle}
- Package: ${task.packageTitle}
- Requirements: ${task.requirements}
${task.buyerNotes ? `- Additional Notes: ${task.buyerNotes}` : ""}

Complete this task to the best of your abilities. Provide a comprehensive, high-quality deliverable.`

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model || "claude-3-5-sonnet-20241022",
        max_tokens: config.maxTokens || 4096,
        system: systemMessage,
        messages: [
          { role: "user", content: task.requirements },
        ],
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || "Anthropic API error")
    }

    const data = await response.json()
    const content = data.content[0]?.text || ""

    return {
      success: true,
      content,
      tokensUsed: data.usage?.input_tokens + data.usage?.output_tokens,
      executionTimeMs: Date.now() - startTime,
    }
  } catch (error) {
    return {
      success: false,
      content: "",
      error: error instanceof Error ? error.message : "Unknown error",
      executionTimeMs: Date.now() - startTime,
    }
  }
}

/**
 * Execute a custom webhook-based agent
 */
async function executeCustomAgent(
  config: AgentConfig,
  task: TaskInput
): Promise<TaskOutput> {
  const startTime = Date.now()

  if (!config.webhookUrl) {
    return {
      success: false,
      content: "",
      error: "No webhook URL configured for custom agent",
      executionTimeMs: Date.now() - startTime,
    }
  }

  try {
    const response = await fetch(config.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agentId: config.id,
        task,
        timestamp: new Date().toISOString(),
      }),
    })

    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}`)
    }

    const data = await response.json()

    return {
      success: true,
      content: data.content || data.result || "",
      attachments: data.attachments,
      executionTimeMs: Date.now() - startTime,
    }
  } catch (error) {
    return {
      success: false,
      content: "",
      error: error instanceof Error ? error.message : "Webhook error",
      executionTimeMs: Date.now() - startTime,
    }
  }
}

/**
 * Main function to execute an agent task
 */
export async function executeAgentTask(
  config: AgentConfig,
  task: TaskInput,
  apiKey: string
): Promise<AgentExecutionResult> {
  try {
    let output: TaskOutput

    switch (config.provider) {
      case "openai":
        output = await executeOpenAIAgent(config, task, apiKey)
        break
      case "anthropic":
        output = await executeAnthropicAgent(config, task, apiKey)
        break
      case "custom":
        output = await executeCustomAgent(config, task)
        break
      default:
        return {
          status: "failed",
          error: `Unknown provider: ${config.provider}`,
        }
    }

    return {
      status: output.success ? "completed" : "failed",
      output,
      error: output.error,
    }
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : "Execution failed",
    }
  }
}

/**
 * Process an order by executing the associated agent
 */
export async function processOrderWithAgent(
  prisma: PrismaClient,
  orderId: string
): Promise<AgentExecutionResult> {
  // Fetch order with all related data
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      gig: {
        include: {
          seller: {
            include: {
              agentProfile: true,
            },
          },
        },
      },
      package: true,
    },
  })

  if (!order) {
    return { status: "failed", error: "Order not found" }
  }

  if (!order.gig.seller.agentProfile) {
    return { status: "failed", error: "Seller is not an AI agent" }
  }

  const agentProfile = order.gig.seller.agentProfile

  // Build agent config
  const config: AgentConfig = {
    id: agentProfile.id,
    name: order.gig.seller.displayName || "AI Agent",
    provider: (agentProfile.provider as AgentProvider) || "openai",
    model: agentProfile.model || "gpt-4-turbo-preview",
    systemPrompt: agentProfile.systemPrompt || "You are a helpful AI assistant.",
    capabilities: agentProfile.capabilities || [],
    webhookUrl: agentProfile.webhookUrl || undefined,
    maxTokens: agentProfile.maxTokens || 4096,
    temperature: agentProfile.temperature || 0.7,
  }

  // Build task input
  const task: TaskInput = {
    orderId: order.id,
    gigTitle: order.gig.title,
    packageTitle: order.package.name,
    requirements: order.requirements || "",
  }

  // Get API key (should be decrypted from secure storage)
  const apiKey = agentProfile.encryptedApiKey || process.env.DEFAULT_AGENT_API_KEY || ""

  if (!apiKey && config.provider !== "custom") {
    return { status: "failed", error: "No API key configured for agent" }
  }

  // Execute the agent
  const result = await executeAgentTask(config, task, apiKey)

  // If successful, create delivery
  if (result.status === "completed" && result.output?.content) {
    await prisma.orderDelivery.create({
      data: {
        orderId: order.id,
        message: result.output.content,
        attachments: result.output.attachments || [],
      },
    })

    // Update order status
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "DELIVERED" },
    })

    // Create notification for buyer
    await prisma.notification.create({
      data: {
        userId: order.buyerId,
        type: "ORDER_DELIVERED",
        title: "Order Delivered",
        message: `Your order for "${order.gig.title}" has been delivered by the AI agent.`,
        data: { orderId: order.id },
      },
    })
  }

  return result
}
