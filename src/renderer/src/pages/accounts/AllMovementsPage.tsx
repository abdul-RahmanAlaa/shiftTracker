import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
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
      movementType: 'عهدة',
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
      movementType: 'عهدة',
      amount: 0,
      shiftId: undefined,
      contractorId: undefined,
      notes: ''
    } as LedgerEntryFormValues
  }

  function isEntryLocked(entry: LedgerRow): boolean {
    return Boolean(
      entry.shiftId &&
      shifts.some((shift) => shift.id === entry.shiftId && shift.status === 'منتهية')
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
      movementType: entry.movementType as 'عهدة' | 'دفعة' | 'اخرى',
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
    if (!confirm(`متأكد إنك عايز تمسح الحركة رقم ${entry.id}؟`)) return
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
    { accessorKey: 'id', header: 'id' },
    { accessorKey: 'entryDate', header: 'التاريخ' },
    {
      id: 'driverName',
      accessorFn: (entry) => drivers.find((driver) => driver.id === entry.driverId)?.name ?? '-',
      header: 'السائق'
    },
    { accessorKey: 'movementType', header: 'نوع الحركة' },
    { accessorKey: 'amount', header: 'المبلغ' },
    { id: 'shiftId', accessorFn: (entry) => entry.shiftId ?? '-', header: 'الوردية' },
    {
      id: 'contractorName',
      accessorFn: (entry) =>
        contractors.find((contractor) => contractor.id === entry.contractorId)?.name ?? '-',
      header: 'المقاول'
    },
    { id: 'notes', accessorFn: (entry) => entry.notes ?? '-', header: 'ملاحظات' },
    {
      id: 'actions',
      header: 'الإجراءات',
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
                  `تفاصيل الحركة ${entry.id}`,
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
              تفاصيل
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={locked}
              title={locked ? 'مرتبطة بوردية مقفولة' : 'تعديل'}
              onClick={() => openEditEntryDialog(entry)}
            >
              تعديل
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={locked}
              title={locked ? 'مرتبطة بوردية مقفولة' : 'مسح'}
              onClick={() => void handleDeleteEntry(entry)}
            >
              مسح
            </Button>
          </div>
        )
      }
    }
  ]

  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">سجل العهد والدفعات</h1>
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
              إضافة حركة
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingEntryId ? 'تعديل حركة' : 'إضافة حركة'}</DialogTitle>
            </DialogHeader>
            <LedgerEntryForm
              form={ledgerForm}
              onSubmit={handleSaveEntry}
              drivers={drivers}
              contractors={contractors}
              shifts={shifts}
              submitLabel={editingEntryId ? 'حفظ التعديل' : 'إضافة'}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card className="min-h-0 flex-1">
        <CardHeader>
          <CardTitle>الحركات</CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-col">
          {loading ? (
            <p className="text-sm text-muted-foreground">جاري التحميل...</p>
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
