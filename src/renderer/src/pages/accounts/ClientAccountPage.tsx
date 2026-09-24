import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { AccountCard, AccountSummary, type ClientAccount } from './AccountTables'

type Client = { id: number; name: string }
const emptyValue = '__none__'
const paymentSchema = z.object({
  entryDate: z.string().min(1, 'تاريخ الدفعة مطلوب'),
  amount: z.number({ message: 'المبلغ مطلوب' }),
  notes: z.string().optional()
})
type PaymentFormValues = z.infer<typeof paymentSchema>

export function ClientAccountPage(): React.JSX.Element {
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState<number>()
  const [account, setAccount] = useState<ClientAccount | null>(null)
  const paymentForm = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { entryDate: '', amount: undefined, notes: '' }
  })

  useEffect(() => {
    void window.api.listClients().then((result) => {
      if (result.ok) setClients(result.data)
    })
  }, [])

  async function loadAccount(clientId: number): Promise<void> {
    const result = await window.api.getClientAccount({ clientId })
    if (result.ok) {
      setAccount(result.data)
    } else {
      setAccount(null)
    }
  }

  async function handleChange(value: string): Promise<void> {
    if (value === emptyValue) {
      setSelectedClientId(undefined)
      setAccount(null)
      return
    }
    const clientId = Number(value)
    setSelectedClientId(clientId)
    await loadAccount(clientId)
  }

  async function handleCreatePayment(values: PaymentFormValues): Promise<void> {
    if (!selectedClientId) return
    const result = await window.api.createClientPayment({ clientId: selectedClientId, ...values })
    if (result.ok) {
      paymentForm.reset()
      await loadAccount(selectedClientId)
    } else {
      result.errors.forEach((error) => {
        if (error.field in values)
          paymentForm.setError(error.field as keyof PaymentFormValues, { message: error.message })
      })
    }
  }

  return (
    <AccountCard title="حساب العميل">
      <Select
        value={selectedClientId ? String(selectedClientId) : emptyValue}
        onValueChange={(value) => void handleChange(value)}
      >
        <SelectTrigger>
          <SelectValue placeholder="اختر العميل" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={emptyValue}>اختر العميل</SelectItem>
          {clients.map((client) => (
            <SelectItem key={client.id} value={String(client.id)}>
              {client.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedClientId && account ? (
        <>
          <AccountSummary
            items={[
              { label: 'مستحق من العميل', value: account.receivableTotal },
              { label: 'إجمالي الكمية (م³)', value: account.totalCubic },
              { label: 'المدفوع', value: account.paidTotal },
              { label: 'الرصيد', value: account.balance, highlight: true }
            ]}
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>id</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>المبلغ</TableHead>
                <TableHead>ملاحظات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {account.payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>{payment.id}</TableCell>
                  <TableCell>{payment.entryDate}</TableCell>
                  <TableCell>{payment.amount}</TableCell>
                  <TableCell>{payment.notes ?? '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Form {...paymentForm}>
            <form
              onSubmit={paymentForm.handleSubmit(handleCreatePayment)}
              className="grid gap-4 md:grid-cols-2"
            >
              <FormField
                control={paymentForm.control}
                name="entryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>تاريخ الدفعة</FormLabel>
                    <FormControl>
                      <DatePicker
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="اختر تاريخ الدفعة"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={paymentForm.control}
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
                control={paymentForm.control}
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
                <Button type="submit">تسجيل الدفعة</Button>
              </div>
            </form>
          </Form>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">اختر عميل عشان تشوف الحساب</p>
      )}
    </AccountCard>
  )
}
