import WebSocket from 'ws'

const OPENCLAW_GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || 'ws://127.0.0.1:18789'
const OPENCLAW_API_KEY = process.env.OPENCLAW_API_KEY

interface OpenClawMessage {
  type: string
  id?: string
  data?: Record<string, unknown>
}

interface TaskSubmitRequest {
  agentId: string
  orderId: string
  taskType: string
  payload: Record<string, unknown>
  webhookUrl: string
}

interface TaskResponse {
  taskId: string
  status: 'queued' | 'accepted' | 'rejected'
  message?: string
}

interface AgentRegistration {
  agentId: string
  name: string
  capabilities: string[]
  webhookUrl: string
}

type MessageHandler = (message: OpenClawMessage) => void

export class OpenClawClient {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private messageHandlers: Map<string, MessageHandler> = new Map()
  private pendingRequests: Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }> = new Map()
  private isConnected = false

  constructor(private gatewayUrl: string = OPENCLAW_GATEWAY_URL) {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.gatewayUrl, {
          headers: OPENCLAW_API_KEY ? { 'X-API-Key': OPENCLAW_API_KEY } : {},
        })

        this.ws.on('open', () => {
          console.log('Connected to OpenClaw Gateway')
          this.isConnected = true
          this.reconnectAttempts = 0
          resolve()
        })

        this.ws.on('message', (data) => {
          this.handleMessage(data.toString())
        })

        this.ws.on('close', () => {
          console.log('Disconnected from OpenClaw Gateway')
          this.isConnected = false
          this.attemptReconnect()
        })

        this.ws.on('error', (error) => {
          console.error('OpenClaw WebSocket error:', error)
          if (!this.isConnected) {
            reject(error)
          }
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  private handleMessage(data: string): void {
    try {
      const message: OpenClawMessage = JSON.parse(data)

      // Handle response to pending request
      if (message.id && this.pendingRequests.has(message.id)) {
        const { resolve, reject } = this.pendingRequests.get(message.id)!
        this.pendingRequests.delete(message.id)

        if (message.type === 'error') {
          reject(new Error(message.data?.message as string || 'Unknown error'))
        } else {
          resolve(message.data)
        }
        return
      }

      // Handle subscribed events
      const handler = this.messageHandlers.get(message.type)
      if (handler) {
        handler(message)
      }
    } catch (error) {
      console.error('Failed to parse OpenClaw message:', error)
    }
  }

  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)

    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`)

    await new Promise((resolve) => setTimeout(resolve, delay))

    try {
      await this.connect()
    } catch (error) {
      console.error('Reconnection failed:', error)
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private async send<T>(type: string, data: Record<string, unknown>): Promise<T> {
    if (!this.ws || !this.isConnected) {
      throw new Error('Not connected to OpenClaw Gateway')
    }

    const id = this.generateId()
    const message: OpenClawMessage = { type, id, data }

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject
      })

      this.ws!.send(JSON.stringify(message), (error) => {
        if (error) {
          this.pendingRequests.delete(id)
          reject(error)
        }
      })

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new Error('Request timeout'))
        }
      }, 30000)
    })
  }

  async submitTask(request: TaskSubmitRequest): Promise<TaskResponse> {
    return this.send<TaskResponse>('task.submit', {
      agent_id: request.agentId,
      order_id: request.orderId,
      task_type: request.taskType,
      payload: request.payload,
      webhook_url: request.webhookUrl,
    })
  }

  async cancelTask(taskId: string): Promise<{ success: boolean }> {
    return this.send<{ success: boolean }>('task.cancel', { task_id: taskId })
  }

  async getTaskStatus(taskId: string): Promise<{
    taskId: string
    status: string
    progress?: number
    result?: Record<string, unknown>
  }> {
    return this.send('task.status', { task_id: taskId })
  }

  async registerAgent(registration: AgentRegistration): Promise<{
    openclawId: string
    status: 'registered' | 'pending_verification'
  }> {
    return this.send('agent.register', {
      agent_id: registration.agentId,
      name: registration.name,
      capabilities: registration.capabilities,
      webhook_url: registration.webhookUrl,
    })
  }

  async unregisterAgent(agentId: string): Promise<{ success: boolean }> {
    return this.send('agent.unregister', { agent_id: agentId })
  }

  async getAgentStatus(agentId: string): Promise<{
    agentId: string
    status: 'online' | 'offline' | 'busy'
    activeTasks: number
  }> {
    return this.send('agent.status', { agent_id: agentId })
  }

  onTaskUpdate(handler: (data: {
    taskId: string
    orderId: string
    status: string
    progress?: number
    message?: string
    result?: Record<string, unknown>
  }) => void): void {
    this.messageHandlers.set('task.update', (message) => {
      handler(message.data as Parameters<typeof handler>[0])
    })
  }

  onAgentStatusChange(handler: (data: {
    agentId: string
    status: string
  }) => void): void {
    this.messageHandlers.set('agent.status_change', (message) => {
      handler(message.data as Parameters<typeof handler>[0])
    })
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
      this.isConnected = false
    }
  }

  get connected(): boolean {
    return this.isConnected
  }
}

// Singleton instance
let openclawClient: OpenClawClient | null = null

export function getOpenClawClient(): OpenClawClient {
  if (!openclawClient) {
    openclawClient = new OpenClawClient()
  }
  return openclawClient
}

// Helper function to dispatch task to agent
export async function dispatchTaskToAgent(
  agentOpenclawId: string,
  orderId: string,
  requirements: string,
  gigDetails: {
    title: string
    description: string
    packageTier: string
  }
): Promise<TaskResponse> {
  const client = getOpenClawClient()

  if (!client.connected) {
    await client.connect()
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  return client.submitTask({
    agentId: agentOpenclawId,
    orderId,
    taskType: 'gig_fulfillment',
    payload: {
      requirements,
      gig: gigDetails,
    },
    webhookUrl: `${appUrl}/api/webhooks/openclaw`,
  })
}
