import { useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useConfirm } from '@/components/ConfirmDialog'
import type { LedgerEntryFormValues } from '@/components/LedgerEntryForm'
import { ipcApi } from '@/lib/ipcErrors'
import type { LedgerRow } from './AccountTables'

type Shift = { id: string; status: string }

type LedgerEntryMutationOptions = {
  form: UseFormReturn<LedgerEntryFormValues>
  getDefaultValues: () => LedgerEntryFormValues
  getCreateValues: () => LedgerEntryFormValues
  onRefresh: () => void | Promise<void>
  shifts: Shift[]
}

type LedgerEntryMutations = {
  editingEntry: LedgerRow | null
  isDialogOpen: boolean
  isEntryLocked: (entry: LedgerRow) => boolean
  openCreateEntryDialog: () => void
  openEditEntryDialog: (entry: LedgerRow) => void
  onDialogOpenChange: (open: boolean) => void
  handleSaveEntry: (values: LedgerEntryFormValues) => Promise<void>
  handleDeleteEntry: (entry: LedgerRow) => Promise<void>
}

const errorFields: Record<string, keyof LedgerEntryFormValues> = {
  entryDate: 'entryDate',
  driverId: 'driverId',
  movementType: 'movementType',
  amount: 'amount',
  shiftId: 'shiftId',
  id: 'shiftId',
  contractorId: 'contractorId',
  notes: 'notes'
}

export function useLedgerEntryMutations({
  form,
  getDefaultValues,
  getCreateValues,
  onRefresh,
  shifts
}: LedgerEntryMutationOptions): LedgerEntryMutations {
  const requestConfirmation = useConfirm()
  const { t } = useTranslation()
  const [editingEntry, setEditingEntry] = useState<LedgerRow | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  function isEntryLocked(entry: LedgerRow): boolean {
    return Boolean(
      entry.shiftId &&
      shifts.some((shift) => shift.id === entry.shiftId && shift.status === 'CLOSED')
    )
  }

  function openCreateEntryDialog(): void {
    setEditingEntry(null)
    form.reset(getCreateValues())
    setIsDialogOpen(true)
  }

  function openEditEntryDialog(entry: LedgerRow): void {
    if (isEntryLocked(entry)) return
    setEditingEntry(entry)
    form.reset({
      entryDate: entry.entryDate,
      driverId: entry.driverId ?? undefined,
      movementType: entry.movementType,
      amount: Number(entry.amount),
      shiftId: entry.shiftId ?? undefined,
      contractorId: entry.contractorId ?? undefined,
      notes: entry.notes ?? ''
    })
    setIsDialogOpen(true)
  }

  function onDialogOpenChange(open: boolean): void {
    setIsDialogOpen(open)
    if (!open) {
      setEditingEntry(null)
      form.reset(getDefaultValues())
    }
  }

  async function handleSaveEntry(values: LedgerEntryFormValues): Promise<void> {
    const result = editingEntry
      ? await ipcApi.updateLedgerEntry({
          id: editingEntry.id,
          ...values,
          driverId: values.driverId ?? null,
          shiftId: values.shiftId ?? null,
          contractorId: values.contractorId ?? null,
          notes: values.notes?.trim() || null
        } satisfies Parameters<typeof ipcApi.updateLedgerEntry>[0])
      : await ipcApi.createLedgerEntry(
          values satisfies Parameters<typeof ipcApi.createLedgerEntry>[0]
        )

    if (result.ok) {
      setIsDialogOpen(false)
      setEditingEntry(null)
      form.reset(getDefaultValues())
      await onRefresh()
      return
    }

    result.errors.forEach((error) => {
      const field = errorFields[error.field]
      if (field) form.setError(field, { message: error.message })
    })
  }

  async function handleDeleteEntry(entry: LedgerRow): Promise<void> {
    if (isEntryLocked(entry)) return
    if (
      !(await requestConfirmation({
        message: t('allMovements.deleteConfirmation', { id: entry.id })
      }))
    )
      return

    const result = await ipcApi.deleteLedgerEntry({ id: entry.id })
    if (!result.ok) return

    if (editingEntry?.id === entry.id) onDialogOpenChange(false)
    await onRefresh()
  }

  return {
    editingEntry,
    isDialogOpen,
    isEntryLocked,
    openCreateEntryDialog,
    openEditEntryDialog,
    onDialogOpenChange,
    handleSaveEntry,
    handleDeleteEntry
  }
}
