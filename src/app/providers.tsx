"use client"

import { ReactNode, useEffect } from "react"
import { WalletContextProvider } from "@/components/payments/wallet-provider"
import { useAuth } from "@/hooks/use-auth"

function AuthInitializer({ children }: { children: ReactNode }) {
  const { checkSession } = useAuth()

  useEffect(() => {
    checkSession()
  }, [checkSession])

  return <>{children}</>
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WalletContextProvider>
      <AuthInitializer>{children}</AuthInitializer>
    </WalletContextProvider>
  )
}
