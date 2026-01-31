import type {
  User,
  AgentProfile,
  Category,
  Gig,
  GigPackage,
  Order,
  Review,
  EscrowTransaction,
  Notification,
  OrderDelivery,
  OrderMessage,
  Dispute,
  OrderStatus,
  GigStatus,
  PackageTier,
  UserType,
  EscrowStatus,
} from '@/generated/prisma'

// Re-export Prisma types
export type {
  User,
  AgentProfile,
  Category,
  Gig,
  GigPackage,
  Order,
  Review,
  EscrowTransaction,
  Notification,
}

export {
  OrderStatus,
  GigStatus,
  PackageTier,
  UserType,
  EscrowStatus,
}

// Extended types with relations
export type UserWithProfile = User & {
  agentProfile: AgentProfile | null
}

export type GigWithDetails = Gig & {
  seller: UserWithProfile
  category: Category
  packages: GigPackage[]
}

export type GigWithPackages = Gig & {
  packages: GigPackage[]
}

export type OrderWithDetails = Order & {
  buyer: User
  seller: UserWithProfile
  gig: Gig & { images?: string[] }
  package: GigPackage
  escrow: EscrowTransaction | null
  reviews: Review[]
  deliveries?: OrderDelivery[]
  messages?: OrderMessage[]
  disputes?: Dispute[]
}

export type CategoryWithChildren = Category & {
  children: Category[]
  _count?: {
    gigs: number
  }
}

// API Response types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// Auth types
export interface AuthUser {
  id: string
  walletAddress: string
  displayName: string | null
  type: UserType
  avatar: string | null
}

export interface SessionPayload {
  userId: string
  walletAddress: string
  exp: number
}

// Wallet types
export interface WalletAuthRequest {
  walletAddress: string
  signature: string
  message: string
}

// Search types
export interface GigSearchParams {
  query?: string
  category?: string
  minPrice?: number
  maxPrice?: number
  deliveryDays?: number
  rating?: number
  sortBy?: 'relevance' | 'price_low' | 'price_high' | 'rating' | 'newest'
  page?: number
  pageSize?: number
}

// Order types
export interface CreateOrderRequest {
  gigId: string
  packageTier: PackageTier
  requirements?: string
}

export interface DeliveryRequest {
  message: string
  attachments?: string[]
}

// Escrow types
export interface EscrowInitRequest {
  orderId: string
  amount: bigint
}

export interface EscrowAccount {
  orderId: string
  buyer: string
  seller: string
  amount: bigint
  status: EscrowStatus
  bump: number
}

// OpenClaw types
export interface OpenClawTask {
  id: string
  agentId: string
  orderId: string
  type: string
  payload: Record<string, unknown>
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
}

export interface OpenClawWebhookPayload {
  event: 'task.started' | 'task.progress' | 'task.completed' | 'task.failed'
  taskId: string
  agentId: string
  data: Record<string, unknown>
}
