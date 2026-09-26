import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { FloatingWindow } from '@/components/FloatingWindow'
import {
  FloatingWindowsContext,
  type FloatingWindowsContextValue
} from '@/components/FloatingWindowsContext'

interface FloatingWindowState {
  id: string
  title: string
  content: ReactNode
  position: { x: number; y: number }
  size: { width: number; height: number }
  zIndex: number
  isMinimized: boolean
  isMaximized: boolean
}

const defaultSize = { width: 620, height: 480 }

export function FloatingWindowsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [windows, setWindows] = useState<FloatingWindowState[]>([])
  const nextZIndex = useRef(1)

  function focusWindow(id: string, restore = false): void {
    const zIndex = nextZIndex.current++
    setWindows((current) =>
      current.map((item) =>
        item.id === id ? { ...item, zIndex, ...(restore ? { isMinimized: false } : {}) } : item
      )
    )
  }

  function openWindow(id: string, title: string, content: ReactNode): void {
    const zIndex = nextZIndex.current++
    setWindows((current) => {
      const existing = current.find((item) => item.id === id)
      if (existing) {
        return current.map((item) =>
          item.id === id ? { ...item, title, content, isMinimized: false, zIndex } : item
        )
      }

      const lastWindow = current[current.length - 1]
      let x = lastWindow ? lastWindow.position.x + 30 : 20
      let y = lastWindow ? lastWindow.position.y + 30 : 20
      if (x + defaultSize.width > window.innerWidth) x = 20
      if (y + defaultSize.height > window.innerHeight - 36) y = 20

      return [
        ...current,
        {
          id,
          title,
          content,
          position: { x, y },
          size: defaultSize,
          zIndex,
          isMinimized: false,
          isMaximized: false
        }
      ]
    })
  }

  function closeWindow(id: string): void {
    setWindows((current) => current.filter((item) => item.id !== id))
  }

  const contextValue: FloatingWindowsContextValue = { openWindow, closeWindow }

  return (
    <FloatingWindowsContext.Provider value={contextValue}>
      {children}
      <div className="fixed inset-0 pointer-events-none z-999">
        {windows
          .filter((item) => !item.isMinimized)
          .map((item) => (
            <div key={item.id} className="pointer-events-none absolute inset-0">
              <FloatingWindow
                title={item.title}
                position={item.position}
                size={item.size}
                zIndex={item.zIndex}
                isMaximized={item.isMaximized}
                onClose={() => closeWindow(item.id)}
                onFocus={() => focusWindow(item.id)}
                onMinimize={() =>
                  setWindows((current) =>
                    current.map((windowState) =>
                      windowState.id === item.id
                        ? { ...windowState, isMinimized: true }
                        : windowState
                    )
                  )
                }
                onToggleMaximize={() =>
                  setWindows((current) =>
                    current.map((windowState) =>
                      windowState.id === item.id
                        ? { ...windowState, isMaximized: !windowState.isMaximized }
                        : windowState
                    )
                  )
                }
                onPositionChange={(position) =>
                  setWindows((current) =>
                    current.map((windowState) =>
                      windowState.id === item.id ? { ...windowState, position } : windowState
                    )
                  )
                }
                onSizeChange={(size) =>
                  setWindows((current) =>
                    current.map((windowState) =>
                      windowState.id === item.id ? { ...windowState, size } : windowState
                    )
                  )
                }
              >
                {item.content}
              </FloatingWindow>
            </div>
          ))}
      </div>
      <div className="fixed bottom-0 inset-x-0 z-1000 flex h-9 items-center gap-2 border-t bg-muted px-2 pointer-events-auto">
        {windows
          .filter((item) => item.isMinimized)
          .map((item) => (
            <button
              key={item.id}
              type="button"
              className="h-7 max-w-48 truncate rounded-sm px-2 text-sm hover:bg-accent"
              onClick={() => focusWindow(item.id, true)}
              title={item.title}
            >
              {item.title}
            </button>
          ))}
      </div>
    </FloatingWindowsContext.Provider>
  )
}
