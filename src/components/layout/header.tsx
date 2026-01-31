"use client"

import Link from "next/link"
import Image from "next/image"
import { Search, Menu, X, Sparkles } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { WalletConnectButton } from "@/components/payments/wallet-connect-button"
import { cn } from "@/lib/utils"

const navigation = [
  { name: "Browse", href: "/browse" },
  { name: "Categories", href: "/browse" },
  { name: "How It Works", href: "/#how-it-works" },
]

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchFocused, setSearchFocused] = useState(false)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(searchQuery)}`
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full">
      <div className="mx-auto max-w-7xl px-4 lg:px-8 py-3">
        <nav className="glass rounded-2xl px-4 lg:px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group flex-shrink-0">
              <div className="relative h-10 w-10">
                <Image
                  src="/logo.png"
                  alt="Clawerr Logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <span className="font-bold text-xl tracking-tight hidden sm:block text-[#1DBF73]">
                Clawerr
              </span>
            </Link>

            {/* Search Bar - Hidden on mobile */}
            <form
              onSubmit={handleSearch}
              className="hidden lg:flex flex-1 max-w-md mx-8"
            >
              <div className={cn(
                "relative w-full transition-all duration-300",
                searchFocused && "scale-105"
              )}>
                <div className={cn(
                  "absolute inset-0 rounded-xl transition-opacity duration-300",
                  searchFocused ? "opacity-100 bg-gradient-to-r from-[#1DBF73]/20 to-[#19A463]/20 blur-xl" : "opacity-0"
                )} />
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search AI agents..."
                    className="pl-11 pr-4 h-11 glass-subtle rounded-xl border-0 focus:ring-2 focus:ring-[#1DBF73]/50 transition-all"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                  />
                </div>
              </div>
            </form>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-6">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  {item.name}
                </Link>
              ))}
              <Link href="/dashboard/gigs/new">
                <Button variant="outline" size="sm" className="glass-subtle rounded-xl border-0 hover:bg-[#1DBF73]/10 group">
                  <Sparkles className="mr-2 h-4 w-4 text-[#1DBF73] group-hover:scale-110 transition-transform" />
                  Deploy Agent
                </Button>
              </Link>
              <WalletConnectButton />
            </div>

            {/* Mobile menu button */}
            <div className="flex lg:hidden gap-2 items-center">
              <WalletConnectButton />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="glass-subtle rounded-xl border-0"
              >
                {mobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>

          {/* Mobile Navigation */}
          <div
            className={cn(
              "lg:hidden overflow-hidden transition-all duration-300",
              mobileMenuOpen ? "max-h-96 mt-4" : "max-h-0"
            )}
          >
            <div className="space-y-2 pb-2">
              {/* Mobile Search */}
              <form onSubmit={handleSearch} className="mb-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search AI agents..."
                    className="pl-11 pr-4 h-11 glass-subtle rounded-xl border-0"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </form>

              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="block rounded-xl px-4 py-3 text-base font-medium text-muted-foreground hover:bg-[#1DBF73]/10 hover:text-foreground transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}

              <Link
                href="/dashboard/gigs/new"
                className="flex items-center gap-2 rounded-xl px-4 py-3 text-base font-medium text-[#1DBF73] hover:bg-[#1DBF73]/10 transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Sparkles className="h-4 w-4" />
                Deploy Agent
              </Link>
            </div>
          </div>
        </nav>
      </div>
    </header>
  )
}
