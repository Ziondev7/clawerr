import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import nacl from 'tweetnacl'
import bs58 from 'bs58'
import prisma from '@/lib/db'
import type { AuthUser, SessionPayload } from '@/types'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-change-me')
const SESSION_COOKIE_NAME = 'session'
const SESSION_DURATION_DAYS = Number(process.env.SESSION_DURATION_DAYS || 7)

export function createSignMessage(walletAddress: string, nonce: string): string {
  return `Sign this message to authenticate with Clawerr.\n\nWallet: ${walletAddress}\nNonce: ${nonce}\nTimestamp: ${Date.now()}`
}

export function verifySignature(
  message: string,
  signature: string,
  publicKey: string
): boolean {
  try {
    const messageBytes = new TextEncoder().encode(message)
    const signatureBytes = bs58.decode(signature)
    const publicKeyBytes = bs58.decode(publicKey)

    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes)
  } catch (error) {
    console.error('Signature verification failed:', error)
    return false
  }
}

export async function createSession(userId: string, walletAddress: string): Promise<string> {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS)

  const token = await new SignJWT({ userId, walletAddress })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(JWT_SECRET)

  // Store session in database
  await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  })

  return token
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)

    // Verify session exists in database
    const session = await prisma.session.findUnique({
      where: { token },
    })

    if (!session || session.expiresAt < new Date()) {
      return null
    }

    return payload as unknown as SessionPayload
  } catch (error) {
    console.error('Session verification failed:', error)
    return null
  }
}

export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)

  if (!sessionCookie?.value) {
    return null
  }

  return verifySession(sessionCookie.value)
}

export async function getSessionFromRequest(request: NextRequest): Promise<SessionPayload | null> {
  // Check Authorization header first
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    return verifySession(token)
  }

  // Fall back to cookie
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)
  if (sessionCookie?.value) {
    return verifySession(sessionCookie.value)
  }

  return null
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await getSessionFromCookies()

  if (!session) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      walletAddress: true,
      displayName: true,
      type: true,
      avatar: true,
    },
  })

  return user
}

export async function getUserFromRequest(request: NextRequest): Promise<AuthUser | null> {
  const session = await getSessionFromRequest(request)

  if (!session) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      walletAddress: true,
      displayName: true,
      type: true,
      avatar: true,
    },
  })

  return user
}

export async function deleteSession(token: string): Promise<void> {
  await prisma.session.delete({
    where: { token },
  }).catch(() => {
    // Session may already be deleted
  })
}

export async function deleteUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { userId },
  })
}

export function generateNonce(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return bs58.encode(array)
}
