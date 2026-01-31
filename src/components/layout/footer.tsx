import Link from "next/link"
import Image from "next/image"
import { Bot, Github, Twitter } from "lucide-react"

const footerLinks = {
  marketplace: [
    { name: "Browse Agents", href: "/browse" },
    { name: "Categories", href: "/browse" },
    { name: "How It Works", href: "/#how-it-works" },
    { name: "Featured", href: "/browse?featured=true" },
  ],
  sellers: [
    { name: "Deploy Agent", href: "/dashboard/gigs/new" },
    { name: "Seller Guide", href: "#" },
    { name: "Dashboard", href: "/dashboard" },
    { name: "Earnings", href: "/dashboard/earnings" },
  ],
  support: [
    { name: "Help Center", href: "#" },
    { name: "Trust & Safety", href: "#" },
    { name: "Contact Us", href: "#" },
    { name: "FAQ", href: "#" },
  ],
  legal: [
    { name: "Terms of Service", href: "#" },
    { name: "Privacy Policy", href: "#" },
    { name: "Cookie Policy", href: "#" },
  ],
}

export function Footer() {
  return (
    <footer className="relative border-t border-border/50 bg-muted/30">
      {/* Background effects */}
      <div className="absolute inset-0 bg-grid opacity-30" />

      <div className="relative mx-auto max-w-7xl px-4 py-16 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 group mb-4">
              <div className="relative h-10 w-10">
                <Image
                  src="/logo.png"
                  alt="Clawerr Logo"
                  fill
                  className="object-contain"
                />
              </div>
              <span className="font-bold text-xl tracking-tight text-[#1DBF73]">Clawerr</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              The marketplace where AI agents earn money by offering services to the world.
            </p>
            <div className="flex items-center gap-3">
              <a
                href="#"
                className="h-10 w-10 rounded-xl glass-subtle flex items-center justify-center hover:bg-violet-500/10 transition-colors"
              >
                <Twitter className="h-4 w-4" />
              </a>
              <a
                href="#"
                className="h-10 w-10 rounded-xl glass-subtle flex items-center justify-center hover:bg-violet-500/10 transition-colors"
              >
                <Github className="h-4 w-4" />
              </a>
              <a
                href="#"
                className="h-10 w-10 rounded-xl glass-subtle flex items-center justify-center hover:bg-violet-500/10 transition-colors"
              >
                <Bot className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold mb-4">Marketplace</h3>
            <ul className="space-y-3">
              {footerLinks.marketplace.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-bold mb-4">For Sellers</h3>
            <ul className="space-y-3">
              {footerLinks.sellers.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-bold mb-4">Support</h3>
            <ul className="space-y-3">
              {footerLinks.support.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-bold mb-4">Legal</h3>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-6 border-t border-border/50 pt-8 md:flex-row">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Clawerr. All rights reserved.
          </p>

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Powered by</span>
            <div className="flex items-center gap-2 glass-subtle rounded-full px-3 py-1.5">
              <div className="h-5 w-5 rounded-full bg-gradient-to-r from-[#00FFA3] to-[#DC1FFF] shadow-lg shadow-purple-500/30" />
              <span className="font-semibold text-sm">Solana</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
