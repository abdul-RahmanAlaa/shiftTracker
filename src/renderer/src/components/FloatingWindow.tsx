import { Minus, Minimize2, Square, X } from 'lucide-react'
import { Rnd } from 'react-rnd'

interface FloatingWindowProps {
  title: string
  onClose: () => void
  onFocus: () => void
  onMinimize: () => void
  isMaximized: boolean
  onToggleMaximize: () => void
  zIndex: number
  position: { x: number; y: number }
  size: { width: number; height: number }
  onPositionChange: (pos: { x: number; y: number }) => void
  onSizeChange: (size: { width: number; height: number }) => void
  children: React.ReactNode
}

export function FloatingWindow({
  title,
  onClose,
  onFocus,
  onMinimize,
  isMaximized,
  onToggleMaximize,
  zIndex,
  position,
  size,
  onPositionChange,
  onSizeChange,
  children
}: FloatingWindowProps): React.JSX.Element {
  return (
    <Rnd
      dragHandleClassName="floating-window-titlebar"
      bounds="parent"
      disableDragging={isMaximized}
      position={isMaximized ? { x: 0, y: 0 } : position}
      size={isMaximized ? { width: '100%', height: '100%' } : size}
      enableResizing={!isMaximized}
      minWidth={320}
      minHeight={240}
      cancel="button"
      onDragStop={(_event, data) => {
        if (!isMaximized) onPositionChange({ x: data.x, y: data.y })
      }}
      onResizeStop={(_event, _direction, element, _delta, nextPosition) => {
        if (isMaximized) return
        onSizeChange({ width: element.offsetWidth, height: element.offsetHeight })
        onPositionChange(nextPosition)
      }}
      style={{ zIndex, pointerEvents: 'auto' }}
      onMouseDown={onFocus}
    >
      <div className="flex h-full w-full flex-col overflow-hidden border border-border bg-card text-card-foreground shadow-2xl">
        <div className="floating-window-titlebar flex h-10 shrink-0 cursor-move items-center justify-between gap-3 border-b bg-muted px-3">
          <span className="min-w-0 truncate text-sm font-medium">{title}</span>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              onClick={onMinimize}
              aria-label="تصغير النافذة"
              title="تصغير"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              onClick={onToggleMaximize}
              aria-label={isMaximized ? 'استعادة النافذة' : 'تكبير النافذة'}
              title={isMaximized ? 'استعادة' : 'تكبير'}
            >
              {isMaximized ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Square className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-red-600 hover:text-white"
              onClick={onClose}
              aria-label="إغلاق النافذة"
              title="إغلاق"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
      </div>
    </Rnd>
  )
}
