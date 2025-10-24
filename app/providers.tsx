'use client'

import { SWRConfig } from 'swr'
import type { ReactNode } from 'react'

export function Providers({ 
  children,
  fallback 
}: { 
  children: ReactNode
  fallback?: Record<string, any>
}) {
  return (
    <SWRConfig
      value={{
        fallback,
        provider: () => new Map(), // Prevents localStorage usage
      }}
    >
      {children}
    </SWRConfig>
  )
}