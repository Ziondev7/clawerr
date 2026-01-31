"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatSol } from "@/lib/solana/escrow-client"
import { formatTokens } from "@/lib/solana/token-client"

export type PaymentMethod = "SOL" | "CLAWERR"

interface PaymentOptionProps {
  method: PaymentMethod
  selected: boolean
  price: string
  balance: number
  disabled?: boolean
  onClick: () => void
}

function PaymentOption({
  method,
  selected,
  price,
  balance,
  disabled,
  onClick,
}: PaymentOptionProps) {
  const isSol = method === "SOL"
  const hasInsufficientBalance = balance < parseFloat(price.replace(/[^0-9.]/g, ""))

  return (
    <Card
      onClick={disabled || hasInsufficientBalance ? undefined : onClick}
      className={cn(
        "flex-1 p-4 cursor-pointer transition-all duration-200",
        selected && "ring-2 ring-primary border-primary",
        (disabled || hasInsufficientBalance) && "opacity-50 cursor-not-allowed",
        !selected && !disabled && !hasInsufficientBalance && "hover:border-primary/50"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
              isSol
                ? "bg-gradient-to-r from-purple-500 to-blue-500 text-white"
                : "bg-gradient-to-r from-orange-500 to-red-500 text-white"
            )}
          >
            {isSol ? "S" : "C"}
          </div>
          <span className="font-semibold">{isSol ? "SOL" : "$CLAWERR"}</span>
        </div>
        {selected && (
          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
            <svg
              className="w-3 h-3 text-primary-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-lg font-bold">
          {price} {isSol ? "SOL" : "$CLAWERR"}
        </p>
        <p className="text-sm text-muted-foreground">
          Balance: {isSol ? balance.toFixed(4) : formatTokens(balance)} {isSol ? "SOL" : "$CLAWERR"}
        </p>
        {hasInsufficientBalance && (
          <Badge variant="destructive" className="text-xs">
            Insufficient balance
          </Badge>
        )}
      </div>
    </Card>
  )
}

export interface PaymentMethodSelectorProps {
  selected: PaymentMethod
  onSelect: (method: PaymentMethod) => void
  solPrice: bigint
  tokenPrice: bigint
  solBalance: number
  tokenBalance: number
  tokenEnabled?: boolean
}

export function PaymentMethodSelector({
  selected,
  onSelect,
  solPrice,
  tokenPrice,
  solBalance,
  tokenBalance,
  tokenEnabled = true,
}: PaymentMethodSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium">Payment Method</label>
      <div className="flex gap-4">
        <PaymentOption
          method="SOL"
          selected={selected === "SOL"}
          price={formatSol(solPrice)}
          balance={solBalance}
          onClick={() => onSelect("SOL")}
        />
        <PaymentOption
          method="CLAWERR"
          selected={selected === "CLAWERR"}
          price={formatTokens(tokenPrice)}
          balance={tokenBalance}
          disabled={!tokenEnabled}
          onClick={() => onSelect("CLAWERR")}
        />
      </div>
      {selected === "CLAWERR" && (
        <p className="text-xs text-muted-foreground">
          Paying with $CLAWERR supports the platform and may qualify you for future rewards.
        </p>
      )}
    </div>
  )
}

export default PaymentMethodSelector
