import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/DataTable'
import { useFloatingWindows } from '@/components/FloatingWindowsContext'
import { LedgerEntryDetailsContent } from '@/components/LedgerEntryDetailsContent'
import {
  LedgerEntryForm,
  ledgerEntrySchema,
  type LedgerEntryFormValues
} from '@/components/LedgerEntryForm'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'

type LedgerRow = Extract<
  Awaited<ReturnType<typeof window.api.listLedgerEntries>>,
  { ok: true }
>['data'][number]
type Driver = { id: number; name: string }
type Contractor = { id: number; name: string }
type Shift = { id: string; status: string }

export function AllMovementsPage(): React.JSX.Element {
  const { t } = useTranslation()
  const { openWindow } = useFloatingWindows()
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [entries, setEntries] = useState<LedgerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null)
  const ledgerForm = useForm<LedgerEntryFormValues>({
    resolver: zodResolver(ledgerEntrySchema),
    defaultValues: {
      entryDate: '',
      driverId: undefined,
      movementType: 'ADVANCE',
      amount: 0,
      shiftId: undefined,
      contractorId: undefined,
      notes: ''
    } as LedgerEntryFormValues
  })

  async function loadEntries(): Promise<void> {
    setLoading(true)
    const result = await window.api.listLedgerEntries()
    if (result.ok) setEntries(result.data)
    setLoading(false)
  }

  useEffect(() => {
    void Promise.all([
      window.api.listDrivers(),
      window.api.listContractors(),
      window.api.listShifts(),
      window.api.listLedgerEntries()
    ]).then(([driversResult, contractorsResult, shiftsResult, entriesResult]) => {
      if (driversResult.ok) setDrivers(driversResult.data)
      if (contractorsResult.ok) setContractors(contractorsResult.data)
      if (shiftsResult.ok) setShifts(shiftsResult.data)
      if (entriesResult.ok) setEntries(entriesResult.data)
      setLoading(false)
    })
  }, [])

  function getDefaultLedgerValues(): LedgerEntryFormValues {
    return {
      entryDate: '',
      driverId: undefined,
      movementType: 'ADVANCE',
      amount: 0,
      shiftId: undefined,
      contractorId: undefined,
      notes: ''
    } as LedgerEntryFormValues
  }

  function isEntryLocked(entry: LedgerRow): boolean {
    return Boolean(
      entry.shiftId &&
      shifts.some((shift) => shift.id === entry.shiftId && shift.status === 'CLOSED')
    )
  }

  function openCreateEntryDialog(): void {
    setEditingEntryId(null)
    ledgerForm.reset(getDefaultLedgerValues())
    setIsCreateDialogOpen(true)
  }

  function openEditEntryDialog(entry: LedgerRow): void {
    setEditingEntryId(entry.id)
    ledgerForm.reset({
      entryDate: entry.entryDate,
      driverId: entry.driverId ?? undefined,
      movementType: entry.movementType as 'ADVANCE' | 'PAYMENT' | 'OTHER',
      amount: Number(entry.amount),
      shiftId: entry.shiftId ?? undefined,
      contractorId: entry.contractorId ?? undefined,
      notes: entry.notes ?? ''
    } as LedgerEntryFormValues)
    setIsCreateDialogOpen(true)
  }

  async function handleSaveEntry(values: LedgerEntryFormValues): Promise<void> {
    const result = editingEntryId
      ? await window.api.updateLedgerEntry({
          id: editingEntryId,
          ...values
        } satisfies Parameters<typeof window.api.updateLedgerEntry>[0])
      : await window.api.createLedgerEntry(
          values satisfies Parameters<typeof window.api.createLedgerEntry>[0]
        )

    if (result.ok) {
      ledgerForm.reset(getDefaultLedgerValues())
      setEditingEntryId(null)
      setIsCreateDialogOpen(false)
      await loadEntries()
    } else {
      result.errors.forEach((error) => {
        if (error.field in values) {
          ledgerForm.setError(error.field as keyof LedgerEntryFormValues, {
            message: error.message
          })
        }
      })
    }
  }

  async function handleDeleteEntry(entry: LedgerRow): Promise<void> {
    if (!confirm(t('allMovements.deleteConfirmation', { id: entry.id }))) return
    const result = await window.api.deleteLedgerEntry({ id: entry.id })
    if (result.ok) {
      if (editingEntryId === entry.id) {
        setEditingEntryId(null)
        ledgerForm.reset(getDefaultLedgerValues())
      }
      await loadEntries()
    }
  }

  const columns: ColumnDef<LedgerRow, unknown>[] = [
    { accessorKey: 'id', header: t('common.columns.id') },
    { accessorKey: 'entryDate', header: t('common.columns.date') },
    {
      id: 'driverName',
      accessorFn: (entry) =>
        drivers.find((driver) => driver.id === entry.driverId)?.name ?? t('common.emptyCell'),
      header: t('ledgerEntryForm.fields.driver')
    },
    { accessorKey: 'movementType', header: t('ledgerEntryForm.fields.movementType') },
    { accessorKey: 'amount', header: t('common.columns.amount') },
    {
      id: 'shiftId',
      accessorFn: (entry) => entry.shiftId ?? t('common.emptyCell'),
      header: t('common.columns.shift')
    },
    {
      id: 'contractorName',
      accessorFn: (entry) =>
        contractors.find((contractor) => contractor.id === entry.contractorId)?.name ??
        t('common.emptyCell'),
      header: t('ledgerEntryForm.fields.contractor')
    },
    {
      id: 'notes',
      accessorFn: (entry) => entry.notes ?? t('common.emptyCell'),
      header: t('common.columns.notes')
    },
    {
      id: 'actions',
      header: t('common.columns.actions'),
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) => {
        const entry = row.original
        const locked = isEntryLocked(entry)

        return (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                openWindow(
                  `ledger-entry-${entry.id}`,
                  t('allMovements.detailsTitle', { id: entry.id }),
                  <LedgerEntryDetailsContent
                    entry={entry}
                    contractorName={
                      contractors.find((contractor) => contractor.id === entry.contractorId)
                        ?.name ?? undefined
                    }
                    driverName={
                      drivers.find((driver) => driver.id === entry.driverId)?.name ?? undefined
                    }
                  />
                )
              }
            >
              {t('common.details')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={locked}
              title={locked ? t('common.lockedShift') : t('common.edit')}
              onClick={() => openEditEntryDialog(entry)}
            >
              {t('common.edit')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={locked}
              title={locked ? t('common.lockedShift') : t('common.delete')}
              onClick={() => void handleDeleteEntry(entry)}
            >
              {t('common.delete')}
            </Button>
          </div>
        )
      }
    }
  ]

  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t('allMovements.title')}</h1>
        <Dialog
          open={isCreateDialogOpen}
          onOpenChange={(open) => {
            setIsCreateDialogOpen(open)
            if (!open) {
              setEditingEntryId(null)
              ledgerForm.reset(getDefaultLedgerValues())
            }
          }}
        >
          <DialogTrigger asChild>
            <Button type="button" onClick={openCreateEntryDialog}>
              {t('allMovements.addMovement')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingEntryId ? t('allMovements.editTitle') : t('allMovements.addMovement')}
              </DialogTitle>
            </DialogHeader>
            <LedgerEntryForm
              form={ledgerForm}
              onSubmit={handleSaveEntry}
              drivers={drivers}
              contractors={contractors}
              shifts={shifts}
              submitLabel={
                editingEntryId
                  ? t('contractorsSettings.saveEdit')
                  : t('contractorsSettings.addSubmit')
              }
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card className="min-h-0 flex-1">
        <CardHeader>
          <CardTitle>{t('allMovements.entriesTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-col">
          {loading ? (
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
          ) : (
            <DataTable
              columns={columns}
              data={entries}
              getRowId={(entry) => String(entry.id)}
              enableRowSelection
              sumColumnId="amount"
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
