import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/db"
import type { OpenClawWebhookPayload } from "@/types"

export async function POST(request: NextRequest) {
  try {
    // Verify webhook authenticity (in production, verify signature)
    const apiKey = request.headers.get("X-OpenClaw-Signature")
    // TODO: Verify signature with OPENCLAW_WEBHOOK_SECRET

    const payload: OpenClawWebhookPayload = await request.json()
    const { event, taskId, agentId, data } = payload

    console.log(`OpenClaw webhook: ${event}`, { taskId, agentId })

    // Get the order associated with this task
    const orderId = data.orderId as string
    if (!orderId) {
      return NextResponse.json(
        { error: "Order ID not found in webhook payload" },
        { status: 400 }
      )
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        seller: {
          include: { agentProfile: true },
        },
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      )
    }

    // Verify the agent matches
    if (order.seller.agentProfile?.openclawId !== agentId) {
      return NextResponse.json(
        { error: "Agent mismatch" },
        { status: 403 }
      )
    }

    switch (event) {
      case "task.started":
        // Agent has started working on the task
        await prisma.orderMessage.create({
          data: {
            orderId: order.id,
            senderId: order.sellerId,
            content: "I've started working on your order.",
          },
        })
        break

      case "task.progress":
        // Agent is making progress
        const progressMessage = data.message as string
        if (progressMessage) {
          await prisma.orderMessage.create({
            data: {
              orderId: order.id,
              senderId: order.sellerId,
              content: progressMessage,
            },
          })
        }
        break

      case "task.completed":
        // Agent has completed the task
        const deliveryMessage = data.deliveryMessage as string || "I've completed your order."
        const attachments = (data.attachments as string[]) || []

        // Create delivery
        await prisma.$transaction([
          prisma.orderDelivery.create({
            data: {
              orderId: order.id,
              message: deliveryMessage,
              attachments,
              isRevision: order.status === "REVISION_REQUESTED",
            },
          }),
          prisma.order.update({
            where: { id: order.id },
            data: { status: "DELIVERED" },
          }),
        ])

        // Notify buyer
        await prisma.notification.create({
          data: {
            userId: order.buyerId,
            type: "ORDER_DELIVERED",
            title: "Order Delivered",
            message: "The AI agent has completed and delivered your order.",
            data: { orderId: order.id },
          },
        })
        break

      case "task.failed":
        // Agent failed to complete the task
        const errorMessage = data.error as string || "An error occurred while processing your order."

        await prisma.orderMessage.create({
          data: {
            orderId: order.id,
            senderId: order.sellerId,
            content: `Error: ${errorMessage}. Please contact support if this persists.`,
          },
        })

        // Notify buyer
        await prisma.notification.create({
          data: {
            userId: order.buyerId,
            type: "MESSAGE_RECEIVED",
            title: "Order Update",
            message: "There was an issue with your order. Please check the order details.",
            data: { orderId: order.id },
          },
        })
        break
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("OpenClaw webhook error:", error)
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    )
  }
}
