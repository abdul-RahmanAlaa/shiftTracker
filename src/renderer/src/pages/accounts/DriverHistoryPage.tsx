import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
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
import { AccountCard, LedgerEntriesTable, type LedgerRow } from './AccountTables'

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

export function DriverHistoryPage(): React.JSX.Element {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [selectedDriverId, setSelectedDriverId] = useState<number>()
  const [history, setHistory] = useState<LedgerRow[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [editingEntry, setEditingEntry] = useState<LedgerRow | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
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

  useEffect(() => {
    void Promise.all([
      window.api.listDrivers(),
      window.api.listContractors(),
      window.api.listShifts()
    ]).then(([driversResult, contractorsResult, shiftsResult]) => {
      if (driversResult.ok) setDrivers(driversResult.data)
      if (contractorsResult.ok) setContractors(contractorsResult.data)
      if (shiftsResult.ok) setShifts(shiftsResult.data)
    })
  }, [])

  async function handleChange(value: string): Promise<void> {
    if (value === emptyValue) {
      setSelectedDriverId(undefined)
      setHistory([])
      return
    }
    const driverId = Number(value)
    setSelectedDriverId(driverId)
    const result = await window.api.getDriverHistory({ driverId })
    if (result.ok) {
      setHistory(result.data)
    } else {
      setHistory([])
    }
  }

  function isEntryLocked(entry: LedgerRow): boolean {
    return Boolean(entry.shiftId && shifts.some((shift) => shift.id === entry.shiftId && shift.status === 'منتهية'))
  }

  function openEditEntryDialog(entry: LedgerRow): void {
    setEditingEntry(entry)
    ledgerForm.reset({
      entryDate: entry.entryDate,
      driverId: entry.driverId ?? undefined,
      movementType: entry.movementType as 'عهدة' | 'دفعة' | 'اخرى',
      amount: Number(entry.amount),
      shiftId: entry.shiftId ?? undefined,
      contractorId: entry.contractorId ?? undefined,
      notes: entry.notes ?? ''
    } as LedgerFormValues)
    setIsEditDialogOpen(true)
  }

  async function handleSaveEntry(values: LedgerFormValues): Promise<void> {
    if (!editingEntry) return
    const result = await window.api.updateLedgerEntry({
      id: editingEntry.id,
      ...values
    } satisfies Parameters<typeof window.api.updateLedgerEntry>[0])
    if (result.ok) {
      setIsEditDialogOpen(false)
      setEditingEntry(null)
      ledgerForm.reset({
        entryDate: '',
        driverId: undefined,
        movementType: 'عهدة',
        amount: 0,
        shiftId: undefined,
        contractorId: undefined,
        notes: ''
      } as LedgerFormValues)
      if (selectedDriverId) await handleChange(String(selectedDriverId))
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
    if (result.ok && selectedDriverId) {
      await handleChange(String(selectedDriverId))
    }
  }

  return (
    <AccountCard title="سجل السائق">
      <Select
        value={selectedDriverId ? String(selectedDriverId) : emptyValue}
        onValueChange={(value) => void handleChange(value)}
      >
        <SelectTrigger>
          <SelectValue placeholder="اختر السائق" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={emptyValue}>اختر السائق</SelectItem>
          {drivers.map((driver) => (
            <SelectItem key={driver.id} value={String(driver.id)}>
              {driver.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedDriverId ? (
        <>
          <LedgerEntriesTable
            entries={history}
            onEditEntry={openEditEntryDialog}
            onDeleteEntry={handleDeleteEntry}
            getIsEntryLocked={isEntryLocked}
          />
          <Dialog
            open={isEditDialogOpen}
            onOpenChange={(open) => {
              setIsEditDialogOpen(open)
              if (!open) {
                setEditingEntry(null)
                ledgerForm.reset({
                  entryDate: '',
                  driverId: undefined,
                  movementType: 'عهدة',
                  amount: 0,
                  shiftId: undefined,
                  contractorId: undefined,
                  notes: ''
                } as LedgerFormValues)
              }
            }}
          >
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>تعديل حركة</DialogTitle>
              </DialogHeader>
              <Form {...ledgerForm}>
                <form onSubmit={ledgerForm.handleSubmit(handleSaveEntry)} className="grid gap-4 md:grid-cols-2">
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
                              <SelectValue placeholder="اختر المقاول" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={emptyValue}>اختر المقاول</SelectItem>
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
                    <Button type="submit">حفظ التعديل</Button>
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
        </>
      ) : (
        <p className="text-sm text-muted-foreground">اختر سائق عشان تشوف الحساب</p>
      )}
    </AccountCard>
  )
}
