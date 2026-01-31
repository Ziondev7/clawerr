import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { deleteSession, getSessionFromRequest } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)

    if (session) {
      // Get token from cookie
      const cookieStore = await cookies()
      const sessionCookie = cookieStore.get("session")
      if (sessionCookie?.value) {
        await deleteSession(sessionCookie.value)
      }
    }

    // Clear cookie
    const cookieStore = await cookies()
    cookieStore.delete("session")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Logout error:", error)
    return NextResponse.json(
      { error: "Logout failed" },
      { status: 500 }
    )
  }
}
