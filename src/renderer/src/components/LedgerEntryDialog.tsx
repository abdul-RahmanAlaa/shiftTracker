import { useTranslation } from 'react-i18next'
import type { UseFormReturn } from 'react-hook-form'
import type { ReactElement } from 'react'
import { LedgerEntryForm, type LedgerEntryFormValues } from '@/components/LedgerEntryForm'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import type { LedgerRow } from '@/pages/accounts/AccountTables'

type LedgerEntryDialogProps = {
  trigger: ReactElement
  open: boolean
  onOpenChange: (open: boolean) => void
  editingEntry: LedgerRow | null
  form: UseFormReturn<LedgerEntryFormValues>
  onSubmit: (values: LedgerEntryFormValues) => Promise<void>
  drivers: { id: number; name: string }[]
  contractors: { id: number; name: string }[]
  shifts: { id: string; status: string }[]
  lockedContractorId?: number
  lockedDriverId?: number
  requireContractorId?: boolean
}

export function LedgerEntryDialog({
  trigger,
  open,
  onOpenChange,
  editingEntry,
  form,
  onSubmit,
  drivers,
  contractors,
  shifts,
  lockedContractorId,
  lockedDriverId,
  requireContractorId = false
}: LedgerEntryDialogProps): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
        closeDisabled={form.formState.isSubmitting}
      >
        <DialogHeader>
          <DialogTitle>
            {editingEntry ? t('allMovements.editTitle') : t('allMovements.addMovement')}
          </DialogTitle>
        </DialogHeader>
        <LedgerEntryForm
          form={form}
          onSubmit={onSubmit}
          drivers={drivers}
          contractors={contractors}
          shifts={shifts}
          lockedContractorId={lockedContractorId}
          lockedDriverId={lockedDriverId}
          requireContractorId={requireContractorId}
          submitLabel={
            editingEntry ? t('contractorsSettings.saveEdit') : t('contractorsSettings.addSubmit')
          }
        />
      </DialogContent>
    </Dialog>
  )
}
