import { ipcApi } from '@/lib/ipcErrors'
import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import type { ColumnDef } from '@tanstack/react-table'
import { Eye, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/DataTable'
import { useFloatingWindows } from '@/components/FloatingWindowsContext'
import { LedgerEntryDetailsContent } from '@/components/LedgerEntryDetailsContent'
import { formatMoney } from '@/lib/numberFormat'
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
  Awaited<ReturnType<typeof ipcApi.listLedgerEntries>>,
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
    const result = await ipcApi.listLedgerEntries()
    if (result.ok) setEntries(result.data)
    setLoading(false)
  }

  useEffect(() => {
    void Promise.all([
      ipcApi.listDrivers(),
      ipcApi.listContractors(),
      ipcApi.listShifts(),
      ipcApi.listLedgerEntries()
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
      ? await ipcApi.updateLedgerEntry({
          id: editingEntryId,
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
    const result = await ipcApi.deleteLedgerEntry({ id: entry.id })
    if (result.ok) {
      if (editingEntryId === entry.id) {
        setEditingEntryId(null)
        ledgerForm.reset(getDefaultLedgerValues())
      }
      await loadEntries()
    }
  }

  const columns: ColumnDef<LedgerRow, unknown>[] = [
    { accessorKey: 'id', header: t('common.columns.id'), meta: { nowrap: true } },
    { accessorKey: 'entryDate', header: t('common.columns.date'), meta: { nowrap: true } },
    {
      id: 'driverName',
      accessorFn: (entry) =>
        drivers.find((driver) => driver.id === entry.driverId)?.name ?? t('common.emptyCell'),
      header: t('ledgerEntryForm.fields.driver')
    },
    {
      accessorKey: 'movementType',
      header: t('ledgerEntryForm.fields.movementType'),
      meta: { nowrap: true }
    },
    {
      accessorKey: 'amount',
      header: t('common.columns.amount'),
      meta: { nowrap: true },
      cell: ({ getValue }) => formatMoney(getValue<number>())
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
      meta: { nowrap: true },
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) => {
        const entry = row.original
        const locked = isEntryLocked(entry)

        return (
          <div className="flex justify-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-7 w-7 p-0"
              aria-label={t('common.details')}
              title={t('common.details')}
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
              <Eye className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-7 w-7 p-0"
              disabled={locked}
              aria-label={t('common.edit')}
              title={locked ? t('common.lockedShift') : t('common.edit')}
              onClick={() => openEditEntryDialog(entry)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="h-7 w-7 p-0"
              disabled={locked}
              aria-label={t('common.delete')}
              title={locked ? t('common.lockedShift') : t('common.delete')}
              onClick={() => void handleDeleteEntry(entry)}
            >
              <Trash2 className="h-3.5 w-3.5" />
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
          <DialogContent
            className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
            closeDisabled={ledgerForm.formState.isSubmitting}
          >
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

      <Card className="flex min-h-0 flex-1 flex-col">
        <CardHeader>
          <CardTitle>{t('allMovements.entriesTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col">
          <DataTable
            columns={columns}
            data={entries}
            loading={loading}
            getRowId={(entry) => String(entry.id)}
            enableRowSelection
            sumColumnId="amount"
            formatSum={formatMoney}
          />
        </CardContent>
      </Card>
    </div>
  )
}
