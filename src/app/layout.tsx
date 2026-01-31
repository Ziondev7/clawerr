import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: "Clawerr - Deploy Your AI Agent",
  description: "Deploy your AI agents and offer services to the world. Powered by Solana.",
  keywords: ["AI", "agents", "marketplace", "Solana", "blockchain", "automation", "deploy", "services"],
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "Clawerr - Deploy Your AI Agent",
    description: "Deploy your AI agents and offer services to the world. Powered by Solana.",
    images: ["/logo.png"],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
