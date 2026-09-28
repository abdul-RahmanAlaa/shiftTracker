import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/DataTable'
import { useFloatingWindows } from '@/components/FloatingWindowsContext'
import { LedgerEntryDetailsContent } from '@/components/LedgerEntryDetailsContent'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

type LedgerRow = Extract<
  Awaited<ReturnType<typeof window.api.listLedgerEntries>>,
  { ok: true }
>['data'][number]
type Driver = { id: number; name: string }
type Contractor = { id: number; name: string }
type Shift = { id: string; status: string }

const emptyValue = '__none__'

const ledgerSchema = z.object({
  entryDate: z.string().min(1, 'تاريخ الحركة مطلوب'),
  driverId: z.number().int().positive().optional(),
  movementType: z.enum(['عهدة', 'دفعة', 'اخرى'], { message: 'نوع الحركة مطلوب' }),
  amount: z.number({ message: 'المبلغ مطلوب' }),
  shiftId: z.string().optional(),
  contractorId: z.number().int().positive().optional(),
  notes: z.string().optional()
})

type LedgerFormValues = z.infer<typeof ledgerSchema>

export function LedgerPage(): React.JSX.Element {
  const { openWindow } = useFloatingWindows()
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [entries, setEntries] = useState<LedgerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null)
  const ledgerForm = useForm<LedgerFormValues>({
    resolver: zodResolver(ledgerSchema),
    defaultValues: {
      entryDate: '',
      driverId: undefined,
      movementType: 'عهدة',
      amount: 0,
      shiftId: undefined,
      contractorId: undefined,
      notes: ''
    } as LedgerFormValues
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

  function getDefaultLedgerValues(): LedgerFormValues {
    return {
      entryDate: '',
      driverId: undefined,
      movementType: 'عهدة',
      amount: 0,
      shiftId: undefined,
      contractorId: undefined,
      notes: ''
    } as LedgerFormValues
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
    } as LedgerFormValues)
    setIsCreateDialogOpen(true)
  }

  async function handleSaveEntry(values: LedgerFormValues): Promise<void> {
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
          ledgerForm.setError(error.field as keyof LedgerFormValues, { message: error.message })
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
            <Form {...ledgerForm}>
              <form
                onSubmit={ledgerForm.handleSubmit(handleSaveEntry)}
                className="grid gap-4 md:grid-cols-2"
              >
                <FormField
                  control={ledgerForm.control}
                  name="entryDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>تاريخ الحركة</FormLabel>
                      <FormControl>
                        <DatePicker
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="اختر تاريخ الحركة"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={ledgerForm.control}
                  name="movementType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>نوع الحركة</FormLabel>
                      <Select value={field.value ?? ''} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="اختر نوع الحركة" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="عهدة">عهدة</SelectItem>
                          <SelectItem value="دفعة">دفعة</SelectItem>
                          <SelectItem value="اخرى">اخرى</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={ledgerForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>المبلغ</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          value={field.value ?? ''}
                          onChange={(event) =>
                            field.onChange(
                              event.target.value === '' ? undefined : Number(event.target.value)
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={ledgerForm.control}
                  name="driverId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>السائق</FormLabel>
                      <Select
                        value={field.value ? String(field.value) : emptyValue}
                        onValueChange={(value) =>
                          field.onChange(value === emptyValue ? undefined : Number(value))
                        }
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="بدون سائق" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={emptyValue}>بدون سائق</SelectItem>
                          {drivers.map((driver) => (
                            <SelectItem key={driver.id} value={String(driver.id)}>
                              {driver.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={ledgerForm.control}
                  name="shiftId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>الوردية</FormLabel>
                      <Select
                        value={field.value ?? emptyValue}
                        onValueChange={(value) =>
                          field.onChange(value === emptyValue ? undefined : value)
                        }
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="بدون وردية" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={emptyValue}>بدون وردية</SelectItem>
                          {shifts.map((shift) => (
                            <SelectItem key={shift.id} value={shift.id}>
                              {shift.id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={ledgerForm.control}
                  name="contractorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>المقاول</FormLabel>
                      <Select
                        value={field.value ? String(field.value) : emptyValue}
                        onValueChange={(value) =>
                          field.onChange(value === emptyValue ? undefined : Number(value))
                        }
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="بدون مقاول" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={emptyValue}>بدون مقاول</SelectItem>
                          {contractors.map((contractor) => (
                            <SelectItem key={contractor.id} value={String(contractor.id)}>
                              {contractor.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={ledgerForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>ملاحظات</FormLabel>
                      <FormControl>
                        <Textarea {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter className="md:col-span-2">
                  <Button type="submit">{editingEntryId ? 'حفظ التعديل' : 'إضافة'}</Button>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">
                      إلغاء
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </form>
            </Form>
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
