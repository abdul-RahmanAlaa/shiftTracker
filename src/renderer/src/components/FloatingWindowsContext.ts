import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'

export interface FloatingWindowsContextValue {
  openWindow: (id: string, title: string, content: ReactNode) => void
  closeWindow: (id: string) => void
}

export const FloatingWindowsContext = createContext<FloatingWindowsContextValue | null>(null)

export function useFloatingWindows(): FloatingWindowsContextValue {
  const context = useContext(FloatingWindowsContext)
  if (!context) throw new Error('useFloatingWindows must be used within FloatingWindowsProvider')
  return context
}
