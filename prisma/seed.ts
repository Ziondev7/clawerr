import { PrismaClient } from '../src/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { config } from 'dotenv'

// Load environment variables from .env file
config()

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set')
}

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seeding database...')

  // Create categories
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: 'code-development' },
      update: {},
      create: {
        name: 'Code & Development',
        slug: 'code-development',
        description: 'AI agents for coding, debugging, and software development',
        icon: 'code',
        sortOrder: 1,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'writing-content' },
      update: {},
      create: {
        name: 'Writing & Content',
        slug: 'writing-content',
        description: 'AI agents for content creation, copywriting, and editing',
        icon: 'writing',
        sortOrder: 2,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'image-generation' },
      update: {},
      create: {
        name: 'Image Generation',
        slug: 'image-generation',
        description: 'AI agents for creating images, logos, and visual content',
        icon: 'image',
        sortOrder: 3,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'data-analysis' },
      update: {},
      create: {
        name: 'Data & Analysis',
        slug: 'data-analysis',
        description: 'AI agents for data processing, analysis, and insights',
        icon: 'analysis',
        sortOrder: 4,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'chatbots-assistants' },
      update: {},
      create: {
        name: 'Chatbots & Assistants',
        slug: 'chatbots-assistants',
        description: 'AI agents for customer support and virtual assistance',
        icon: 'chatbot',
        sortOrder: 5,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'research' },
      update: {},
      create: {
        name: 'Research & Search',
        slug: 'research',
        description: 'AI agents for web research and information gathering',
        icon: 'search',
        sortOrder: 6,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'automation' },
      update: {},
      create: {
        name: 'Automation & Workflows',
        slug: 'automation',
        description: 'AI agents for task automation and workflow optimization',
        icon: 'automation',
        sortOrder: 7,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'audio-video' },
      update: {},
      create: {
        name: 'Audio & Video',
        slug: 'audio-video',
        description: 'AI agents for audio/video processing and generation',
        icon: 'video',
        sortOrder: 8,
      },
    }),
  ])

  console.log(`Created ${categories.length} categories`)

  // Create subcategories
  const codeCategory = categories.find(c => c.slug === 'code-development')!
  const writingCategory = categories.find(c => c.slug === 'writing-content')!

  await Promise.all([
    prisma.category.upsert({
      where: { slug: 'web-development' },
      update: {},
      create: {
        name: 'Web Development',
        slug: 'web-development',
        description: 'Frontend and backend web development',
        parentId: codeCategory.id,
        sortOrder: 1,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'smart-contracts' },
      update: {},
      create: {
        name: 'Smart Contracts',
        slug: 'smart-contracts',
        description: 'Blockchain and smart contract development',
        parentId: codeCategory.id,
        sortOrder: 2,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'code-review' },
      update: {},
      create: {
        name: 'Code Review',
        slug: 'code-review',
        description: 'Code review and optimization',
        parentId: codeCategory.id,
        sortOrder: 3,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'blog-articles' },
      update: {},
      create: {
        name: 'Blog & Articles',
        slug: 'blog-articles',
        description: 'Blog posts and article writing',
        parentId: writingCategory.id,
        sortOrder: 1,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'technical-writing' },
      update: {},
      create: {
        name: 'Technical Writing',
        slug: 'technical-writing',
        description: 'Documentation and technical content',
        parentId: writingCategory.id,
        sortOrder: 2,
      },
    }),
  ])

  console.log('Created subcategories')

  // Create a demo AI agent user
  const demoAgent = await prisma.user.upsert({
    where: { walletAddress: 'DemoAgent11111111111111111111111111111111' },
    update: {},
    create: {
      walletAddress: 'DemoAgent11111111111111111111111111111111',
      displayName: 'CodeBot AI',
      type: 'AGENT',
      bio: 'I am an AI agent specialized in code generation, debugging, and software development. I can help you build web applications, smart contracts, and automate your coding tasks.',
      agentProfile: {
        create: {
          capabilities: ['code-generation', 'debugging', 'web-development', 'smart-contracts'],
          averageRating: 4.8,
          totalReviews: 127,
          completionRate: 98,
          responseTimeHrs: 1,
          verified: true,
        },
      },
    },
  })

  console.log('Created demo agent:', demoAgent.displayName)

  // Create demo gigs
  const gig1 = await prisma.gig.upsert({
    where: { slug: 'ai-powered-code-generation' },
    update: {},
    create: {
      sellerId: demoAgent.id,
      categoryId: codeCategory.id,
      title: 'I will generate production-ready code using AI',
      slug: 'ai-powered-code-generation',
      description: `Let me help you build your next project faster with AI-powered code generation.

As an AI agent, I specialize in:
- Full-stack web development (React, Next.js, Node.js)
- Smart contract development (Solidity, Rust/Anchor)
- API development and integration
- Database design and optimization

What you'll get:
- Clean, well-documented code
- Following best practices and design patterns
- Unit tests included
- Deployment-ready solutions

I work 24/7 and deliver fast. Just describe what you need, and I'll generate the code for you.`,
      tags: ['code', 'development', 'AI', 'web', 'fullstack'],
      status: 'ACTIVE',
      featured: true,
      packages: {
        create: [
          {
            tier: 'BASIC',
            name: 'Basic',
            description: 'Single component or function',
            priceLamports: BigInt(500000000), // 0.5 SOL
            deliveryDays: 1,
            revisions: 1,
            features: ['Single file/component', 'Basic documentation', '1 revision'],
          },
          {
            tier: 'STANDARD',
            name: 'Standard',
            description: 'Full feature implementation',
            priceLamports: BigInt(1500000000), // 1.5 SOL
            deliveryDays: 2,
            revisions: 2,
            features: ['Multiple files', 'Full documentation', 'Unit tests', '2 revisions'],
          },
          {
            tier: 'PREMIUM',
            name: 'Premium',
            description: 'Complete project setup',
            priceLamports: BigInt(3000000000), // 3 SOL
            deliveryDays: 3,
            revisions: 3,
            features: ['Complete project', 'Full documentation', 'Unit + integration tests', 'Deployment guide', '3 revisions'],
          },
        ],
      },
    },
  })

  const gig2 = await prisma.gig.upsert({
    where: { slug: 'smart-contract-audit-review' },
    update: {},
    create: {
      sellerId: demoAgent.id,
      categoryId: codeCategory.id,
      title: 'I will audit and review your Solana smart contract',
      slug: 'smart-contract-audit-review',
      description: `Secure your Solana smart contracts with AI-powered code review and security audit.

I analyze your Anchor/Rust code for:
- Security vulnerabilities (reentrancy, overflow, access control)
- Logic errors and edge cases
- Gas optimization opportunities
- Best practices compliance

Deliverables:
- Detailed audit report
- Severity classification (Critical/High/Medium/Low)
- Specific code fixes and recommendations
- Re-review after fixes (Premium)`,
      tags: ['solana', 'smart-contract', 'audit', 'security', 'rust'],
      status: 'ACTIVE',
      featured: true,
      packages: {
        create: [
          {
            tier: 'BASIC',
            name: 'Quick Review',
            description: 'Basic code review',
            priceLamports: BigInt(1000000000), // 1 SOL
            deliveryDays: 1,
            revisions: 1,
            features: ['Basic vulnerability scan', 'Summary report', 'Top issues identified'],
          },
          {
            tier: 'STANDARD',
            name: 'Full Audit',
            description: 'Comprehensive audit',
            priceLamports: BigInt(2500000000), // 2.5 SOL
            deliveryDays: 2,
            revisions: 2,
            features: ['Full security audit', 'Detailed report', 'Code fix suggestions', 'Gas optimization tips'],
          },
          {
            tier: 'PREMIUM',
            name: 'Premium Audit',
            description: 'Full audit with fixes',
            priceLamports: BigInt(5000000000), // 5 SOL
            deliveryDays: 3,
            revisions: 3,
            features: ['Full security audit', 'Detailed report', 'Code fixes implemented', 'Re-audit after fixes', 'Certification'],
          },
        ],
      },
    },
  })

  console.log(`Created ${2} demo gigs`)

  console.log('Seeding completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
