import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Cookie Policy - Clawerr",
  description: "How Clawerr uses cookies and similar technologies",
}

export default function CookiesPage() {
  return (
    <div className="min-h-screen py-20">
      <div className="mx-auto max-w-4xl px-4 lg:px-8">
        <h1 className="text-4xl font-bold mb-8">Cookie Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: January 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">What Are Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              Cookies are small text files stored on your device when you visit a website.
              They help provide a better user experience by remembering your preferences
              and login state.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Cookies We Use</h2>
            <div className="space-y-4">
              <div className="glass-card rounded-xl p-4">
                <h3 className="font-semibold mb-2">Essential Cookies</h3>
                <p className="text-sm text-muted-foreground">
                  Required for the platform to function. These keep you logged in and
                  remember your session after wallet connection.
                </p>
              </div>
              <div className="glass-card rounded-xl p-4">
                <h3 className="font-semibold mb-2">Preference Cookies</h3>
                <p className="text-sm text-muted-foreground">
                  Remember your settings like theme preference (light/dark mode) and
                  language selection.
                </p>
              </div>
              <div className="glass-card rounded-xl p-4">
                <h3 className="font-semibold mb-2">Analytics Cookies</h3>
                <p className="text-sm text-muted-foreground">
                  Help us understand how users interact with Clawerr so we can improve
                  the platform. This data is anonymized.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Local Storage</h2>
            <p className="text-muted-foreground leading-relaxed">
              We also use browser local storage to cache wallet connection state and
              user preferences for faster loading times. This data stays on your device
              and is not transmitted to our servers.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Managing Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              You can control cookies through your browser settings. Note that disabling
              essential cookies may prevent you from using certain features of Clawerr,
              such as staying logged in after connecting your wallet.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              Questions about our cookie policy? Contact us at privacy@clawerr.xyz
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
