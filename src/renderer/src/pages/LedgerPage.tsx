import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/DataTable'
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
type Shift = { id: string }

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
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [entries, setEntries] = useState<LedgerRow[]>([])
  const [loading, setLoading] = useState(true)
  const ledgerForm = useForm<LedgerFormValues>({
    resolver: zodResolver(ledgerSchema),
    defaultValues: {
      entryDate: '',
      driverId: undefined,
      movementType: undefined,
      amount: undefined,
      shiftId: undefined,
      contractorId: undefined,
      notes: ''
    }
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

  async function handleCreateEntry(values: LedgerFormValues): Promise<void> {
    const result = await window.api.createLedgerEntry(values)
    if (result.ok) {
      ledgerForm.reset()
      await loadEntries()
    } else {
      result.errors.forEach((error) => {
        if (error.field in values) {
          ledgerForm.setError(error.field as keyof LedgerFormValues, { message: error.message })
        }
      })
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
    { id: 'notes', accessorFn: (entry) => entry.notes ?? '-', header: 'ملاحظات' }
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">سجل العهد والدفعات</h1>
      <Card>
        <CardHeader>
          <CardTitle>إضافة حركة</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...ledgerForm}>
            <form
              onSubmit={ledgerForm.handleSubmit(handleCreateEntry)}
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
              <div className="md:col-span-2">
                <Button type="submit">إضافة</Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>الحركات</CardTitle>
        </CardHeader>
        <CardContent>
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
