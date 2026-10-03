import type { ComponentProps, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

type SubmitButtonProps = Omit<ComponentProps<typeof Button>, 'type' | 'disabled'> & {
  isSubmitting: boolean
  disabled?: boolean
  children: ReactNode
}

export function SubmitButton({
  isSubmitting,
  disabled = false,
  children,
  ...props
}: SubmitButtonProps): React.JSX.Element {
  return (
    <Button {...props} type="submit" disabled={isSubmitting || disabled}>
      {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </Button>
  )
}
