import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'

interface ConfirmOptions {
  message: string
  title?: string
  confirmText?: string
  cancelText?: string
  destructive?: boolean
}

interface ConfirmRequest extends ConfirmOptions {
  resolve: (confirmed: boolean) => void
  returnFocusElement: HTMLElement | null
}

type ConfirmFunction = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFunction | null>(null)

interface ConfirmDialogProps {
  request: ConfirmRequest | null
  onAnswer: (confirmed: boolean) => void
}

function ConfirmDialog({ request, onAnswer }: ConfirmDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const returnFocusElement = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (request) returnFocusElement.current = request.returnFocusElement
  }, [request])

  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && onAnswer(false)}>
      <DialogContent
        dir="rtl"
        className="text-right"
        onCloseAutoFocus={(event) => {
          const target = returnFocusElement.current
          if (!target?.isConnected) return
          event.preventDefault()
          target.focus()
        }}
      >
        {request && (
          <>
            <DialogHeader>
              <DialogTitle>{request.title ?? t('common.confirmationTitle')}</DialogTitle>
              <DialogDescription data-testid="confirm-dialog-message">
                {request.message}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onAnswer(false)}>
                {request.cancelText ?? t('common.cancel')}
              </Button>
              <Button
                type="button"
                variant={request.destructive === false ? 'default' : 'destructive'}
                onClick={() => onAnswer(true)}
              >
                {request.confirmText ?? t('common.confirm')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function ConfirmProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [activeRequest, setActiveRequest] = useState<ConfirmRequest | null>(null)
  const activeRequestRef = useRef<ConfirmRequest | null>(null)
  const requestQueue = useRef<ConfirmRequest[]>([])

  const confirm = useCallback<ConfirmFunction>((options) => {
    return new Promise<boolean>((resolve) => {
      const activeElement = document.activeElement
      const request: ConfirmRequest = {
        ...options,
        resolve,
        returnFocusElement: activeElement instanceof HTMLElement ? activeElement : null
      }

      if (activeRequestRef.current || requestQueue.current.length > 0) {
        requestQueue.current.push(request)
        return
      }

      activeRequestRef.current = request
      setActiveRequest(request)
    })
  }, [])

  const answer = useCallback((confirmed: boolean): void => {
    const request = activeRequestRef.current
    if (!request) return
    request.resolve(confirmed)
    activeRequestRef.current = null
    setActiveRequest(null)
  }, [])

  useEffect(() => {
    if (activeRequest !== null || activeRequestRef.current !== null) return
    const nextRequest = requestQueue.current.shift()
    if (!nextRequest) return
    activeRequestRef.current = nextRequest
    setActiveRequest(nextRequest)
  }, [activeRequest])

  useEffect(
    () => () => {
      activeRequestRef.current?.resolve(false)
      requestQueue.current.forEach((request) => request.resolve(false))
      activeRequestRef.current = null
      requestQueue.current = []
    },
    []
  )

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog request={activeRequest} onAnswer={answer} />
    </ConfirmContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm(): ConfirmFunction {
  const confirm = useContext(ConfirmContext)
  if (!confirm) throw new Error('useConfirm must be used within ConfirmProvider')
  return confirm
}
