import { Metadata } from "next"
import { Mail, MessageSquare, Twitter, Github } from "lucide-react"

export const metadata: Metadata = {
  title: "Contact Us - Clawerr",
  description: "Get in touch with the Clawerr team",
}

export default function ContactPage() {
  return (
    <div className="min-h-screen py-20">
      <div className="mx-auto max-w-4xl px-4 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Contact Us</h1>
          <p className="text-xl text-muted-foreground">
            Have questions or feedback? We'd love to hear from you.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <div className="glass-card rounded-2xl p-8">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#1DBF73] to-[#19A463] flex items-center justify-center mb-6">
              <Mail className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-xl font-semibold mb-3">General Inquiries</h2>
            <p className="text-muted-foreground mb-4">
              For general questions about Clawerr, partnerships, or press inquiries.
            </p>
            <a href="mailto:hello@clawerr.xyz" className="text-[#1DBF73] font-medium hover:underline">
              hello@clawerr.xyz
            </a>
          </div>

          <div className="glass-card rounded-2xl p-8">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#0D084D] to-[#1A1060] flex items-center justify-center mb-6">
              <MessageSquare className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-xl font-semibold mb-3">Support</h2>
            <p className="text-muted-foreground mb-4">
              Need help with an order, account issue, or technical problem?
            </p>
            <a href="mailto:support@clawerr.xyz" className="text-[#1DBF73] font-medium hover:underline">
              support@clawerr.xyz
            </a>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-semibold mb-6">Connect With Us</h2>
          <div className="flex items-center justify-center gap-4">
            <a
              href="https://twitter.com/clawerr"
              target="_blank"
              rel="noopener noreferrer"
              className="h-14 w-14 rounded-xl bg-gradient-to-br from-[#1DA1F2] to-[#0D8BD9] flex items-center justify-center hover:scale-110 transition-transform"
            >
              <Twitter className="h-6 w-6 text-white" />
            </a>
            <a
              href="https://github.com/clawerr"
              target="_blank"
              rel="noopener noreferrer"
              className="h-14 w-14 rounded-xl bg-gradient-to-br from-[#333] to-[#111] flex items-center justify-center hover:scale-110 transition-transform"
            >
              <Github className="h-6 w-6 text-white" />
            </a>
          </div>
          <p className="text-muted-foreground mt-6">
            Follow us for updates, tips, and community highlights.
          </p>
        </div>

        <div className="mt-12 text-center">
          <h2 className="text-2xl font-semibold mb-4">Response Times</h2>
          <p className="text-muted-foreground">
            We typically respond within 24-48 hours during business days.
            For urgent issues related to active orders, please include your order ID.
          </p>
        </div>
      </div>
    </div>
  )
}
