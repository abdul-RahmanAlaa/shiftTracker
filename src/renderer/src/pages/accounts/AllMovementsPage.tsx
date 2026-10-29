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
import { LedgerEntryDialog } from '@/components/LedgerEntryDialog'
import { formatMoney } from '@/lib/numberFormat'
import { ledgerEntrySchema, type LedgerEntryFormValues } from '@/components/LedgerEntryForm'
import { useLedgerEntryMutations } from './useLedgerEntryMutations'

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
    try {
      const result = await ipcApi.listLedgerEntries()
      if (result.ok) setEntries(result.data)
    } finally {
      setLoading(false)
    }
  }

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

  const ledgerMutations = useLedgerEntryMutations({
    form: ledgerForm,
    getDefaultValues: getDefaultLedgerValues,
    getCreateValues: getDefaultLedgerValues,
    onRefresh: loadEntries,
    shifts
  })

  useEffect(() => {
    void Promise.all([
      ipcApi.listDrivers(),
      ipcApi.listContractors(),
      ipcApi.listShifts(),
      ipcApi.listLedgerEntries()
    ])
      .then(([driversResult, contractorsResult, shiftsResult, entriesResult]) => {
        if (driversResult.ok) setDrivers(driversResult.data)
        if (contractorsResult.ok) setContractors(contractorsResult.data)
        if (shiftsResult.ok) setShifts(shiftsResult.data)
        if (entriesResult.ok) setEntries(entriesResult.data)
      })
      .finally(() => setLoading(false))
  }, [])

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
        const locked = ledgerMutations.isEntryLocked(entry)

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
              onClick={() => ledgerMutations.openEditEntryDialog(entry)}
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
              onClick={() => void ledgerMutations.handleDeleteEntry(entry)}
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
        <LedgerEntryDialog
          trigger={
            <Button type="button" onClick={ledgerMutations.openCreateEntryDialog}>
              {t('allMovements.addMovement')}
            </Button>
          }
          open={ledgerMutations.isDialogOpen}
          onOpenChange={ledgerMutations.onDialogOpenChange}
          editingEntry={ledgerMutations.editingEntry}
          form={ledgerForm}
          onSubmit={ledgerMutations.handleSaveEntry}
          drivers={drivers}
          contractors={contractors}
          shifts={shifts}
        />
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
