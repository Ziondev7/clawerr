/**
 * ElizaOS Webhook Handler
 *
 * Receives task completion callbacks from ElizaOS agents
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/db"

interface ElizaWebhookPayload {
  event: 'task.completed' | 'task.failed' | 'task.progress' | 'agent.status'
  task_id?: string
  order_id?: string
  agent_id?: string
  status?: string
  progress?: number
  result?: {
    output: string
    attachments?: string[]
    metadata?: Record<string, unknown>
  }
  error?: string
  timestamp: string
}

export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature (in production, verify with shared secret)
    const signature = request.headers.get('x-elizaos-signature')
    // TODO: Implement signature verification

    const payload: ElizaWebhookPayload = await request.json()

    console.log('ElizaOS webhook received:', payload.event, payload.order_id)

    switch (payload.event) {
      case 'task.completed':
        if (payload.order_id && payload.result) {
          // Find the order
          const order = await prisma.order.findUnique({
            where: { id: payload.order_id },
            include: { seller: true },
          })

          if (order) {
            // Create delivery with the result
            await prisma.orderDelivery.create({
              data: {
                orderId: order.id,
                message: payload.result.output,
                attachments: payload.result.attachments || [],
                isRevision: false,
              },
            })

            // Update order status
            await prisma.order.update({
              where: { id: order.id },
              data: { status: 'DELIVERED' },
            })

            // Notify buyer
            await prisma.notification.create({
              data: {
                userId: order.buyerId,
                type: 'ORDER_DELIVERED',
                title: 'Order Delivered',
                message: 'Your order has been delivered by the AI agent.',
                data: {
                  orderId: order.id,
                  agentProvider: 'ELIZAOS',
                },
              },
            })
          }
        }
        break

      case 'task.failed':
        if (payload.order_id) {
          const order = await prisma.order.findUnique({
            where: { id: payload.order_id },
          })

          if (order) {
            // Create a message about the failure
            await prisma.orderMessage.create({
              data: {
                orderId: order.id,
                senderId: order.sellerId,
                content: `Task processing encountered an issue: ${payload.error || 'Unknown error'}. The agent will retry or a human operator will assist.`,
              },
            })

            // Notify seller about the failure
            await prisma.notification.create({
              data: {
                userId: order.sellerId,
                type: 'ORDER_CREATED',
                title: 'Agent Task Failed',
                message: `ElizaOS agent failed to complete order. Manual intervention may be required.`,
                data: {
                  orderId: order.id,
                  error: payload.error,
                },
              },
            })
          }
        }
        break

      case 'task.progress':
        // Log progress updates (could be stored for real-time UI updates)
        console.log(`Task ${payload.task_id} progress: ${payload.progress}%`)
        break

      case 'agent.status':
        // Update agent status in database
        if (payload.agent_id) {
          await prisma.agentProfile.updateMany({
            where: { elizaId: payload.agent_id },
            data: {
              // Could add online/offline status field
              updatedAt: new Date(),
            },
          })
        }
        break

      default:
        console.log('Unknown ElizaOS webhook event:', payload.event)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('ElizaOS webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}
