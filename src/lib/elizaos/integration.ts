/**
 * ElizaOS Integration Client
 *
 * Integrates with ElizaOS agents for task execution on Clawerr.
 * ElizaOS is an agentic operating system that supports multiple platforms
 * (Discord, Telegram, X, HTTP, onchain) through a unified message bus.
 *
 * @see https://elizaos.ai/
 * @see https://docs.elizaos.ai/
 */

const ELIZAOS_API_URL = process.env.ELIZAOS_API_URL || 'https://api.elizaos.ai'
const ELIZAOS_API_KEY = process.env.ELIZAOS_API_KEY

export interface ElizaCharacter {
  name: string
  description: string
  personality: string[]
  expertise: string[]
  style: {
    tone: string
    formality: 'casual' | 'professional' | 'formal'
  }
  plugins?: string[]
}

export interface ElizaAgentConfig {
  characterId?: string
  character?: ElizaCharacter
  webhookUrl: string
  capabilities: string[]
}

export interface ElizaTaskRequest {
  agentId: string
  orderId: string
  taskType: string
  input: {
    requirements: string
    context: Record<string, unknown>
  }
  callbackUrl: string
}

export interface ElizaTaskResponse {
  taskId: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  result?: {
    output: string
    attachments?: string[]
    metadata?: Record<string, unknown>
  }
  error?: string
}

export interface ElizaAgentStatus {
  agentId: string
  online: boolean
  activeRooms: number
  activeTasks: number
  lastActive: string
}

class ElizaOSClient {
  private apiUrl: string
  private apiKey?: string

  constructor(apiUrl: string = ELIZAOS_API_URL, apiKey?: string) {
    this.apiUrl = apiUrl
    this.apiKey = apiKey || ELIZAOS_API_KEY
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    const response = await fetch(`${this.apiUrl}${endpoint}`, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }))
      throw new Error(error.message || `ElizaOS API error: ${response.status}`)
    }

    return response.json()
  }

  /**
   * Register a new agent with ElizaOS
   */
  async registerAgent(config: ElizaAgentConfig): Promise<{
    agentId: string
    characterId: string
    status: 'active' | 'pending'
  }> {
    return this.request('/v1/agents/register', {
      method: 'POST',
      body: JSON.stringify({
        character: config.character,
        character_id: config.characterId,
        webhook_url: config.webhookUrl,
        capabilities: config.capabilities,
      }),
    })
  }

  /**
   * Update an existing agent's configuration
   */
  async updateAgent(
    agentId: string,
    updates: Partial<ElizaAgentConfig>
  ): Promise<{ success: boolean }> {
    return this.request(`/v1/agents/${agentId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
  }

  /**
   * Get agent status
   */
  async getAgentStatus(agentId: string): Promise<ElizaAgentStatus> {
    return this.request(`/v1/agents/${agentId}/status`)
  }

  /**
   * Submit a task to an ElizaOS agent
   */
  async submitTask(request: ElizaTaskRequest): Promise<ElizaTaskResponse> {
    return this.request('/v1/tasks/submit', {
      method: 'POST',
      body: JSON.stringify({
        agent_id: request.agentId,
        order_id: request.orderId,
        task_type: request.taskType,
        input: request.input,
        callback_url: request.callbackUrl,
      }),
    })
  }

  /**
   * Get task status
   */
  async getTaskStatus(taskId: string): Promise<ElizaTaskResponse> {
    return this.request(`/v1/tasks/${taskId}`)
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId: string): Promise<{ success: boolean }> {
    return this.request(`/v1/tasks/${taskId}/cancel`, {
      method: 'POST',
    })
  }

  /**
   * Send a message to an agent in a specific room
   */
  async sendMessage(
    agentId: string,
    roomId: string,
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<{
    messageId: string
    response?: string
  }> {
    return this.request(`/v1/agents/${agentId}/rooms/${roomId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message, metadata }),
    })
  }

  /**
   * List available character templates
   */
  async listCharacters(): Promise<{
    characters: Array<{
      id: string
      name: string
      description: string
      category: string
    }>
  }> {
    return this.request('/v1/characters')
  }

  /**
   * Get a specific character template
   */
  async getCharacter(characterId: string): Promise<ElizaCharacter> {
    return this.request(`/v1/characters/${characterId}`)
  }

  /**
   * Deactivate an agent
   */
  async deactivateAgent(agentId: string): Promise<{ success: boolean }> {
    return this.request(`/v1/agents/${agentId}/deactivate`, {
      method: 'POST',
    })
  }
}

// Singleton instance
let elizaClient: ElizaOSClient | null = null

export function getElizaOSClient(): ElizaOSClient {
  if (!elizaClient) {
    elizaClient = new ElizaOSClient()
  }
  return elizaClient
}

/**
 * Helper function to dispatch a task to an ElizaOS agent
 */
export async function dispatchTaskToElizaAgent(
  elizaAgentId: string,
  orderId: string,
  requirements: string,
  gigDetails: {
    title: string
    description: string
    packageTier: string
  }
): Promise<ElizaTaskResponse> {
  const client = getElizaOSClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  return client.submitTask({
    agentId: elizaAgentId,
    orderId,
    taskType: 'gig_fulfillment',
    input: {
      requirements,
      context: {
        gig: gigDetails,
        platform: 'clawerr',
      },
    },
    callbackUrl: `${appUrl}/api/webhooks/elizaos`,
  })
}

/**
 * Create a default character for a Clawerr agent
 */
export function createDefaultCharacter(
  name: string,
  capabilities: string[],
  systemPrompt?: string
): ElizaCharacter {
  return {
    name,
    description: `${name} is an AI agent on Clawerr marketplace specializing in ${capabilities.join(', ')}.`,
    personality: [
      'professional',
      'helpful',
      'detail-oriented',
      'efficient',
    ],
    expertise: capabilities,
    style: {
      tone: systemPrompt?.includes('friendly') ? 'warm and approachable' : 'professional and clear',
      formality: 'professional',
    },
    plugins: [
      '@elizaos/plugin-solana', // For Solana integration
    ],
  }
}

export { ElizaOSClient }
