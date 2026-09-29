import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import i18n from 'i18next'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/DataTable'
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
import {
  AccountCard,
  AccountSummary,
  getClientPaymentColumns,
  type ClientAccount
} from './AccountTables'

type Client = { id: number; name: string }
const emptyValue = '__none__'
const paymentSchema = z.object({
  entryDate: z.string().min(1, i18n.t('clientAccount.validation.dateRequired')),
  amount: z.number({ message: i18n.t('common.validation.amountRequired') }),
  notes: z.string().optional()
})
type PaymentFormValues = z.infer<typeof paymentSchema>

export function ClientAccountPage(): React.JSX.Element {
  const { t } = useTranslation()
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState<number>()
  const [account, setAccount] = useState<ClientAccount | null>(null)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [editingPaymentId, setEditingPaymentId] = useState<number | null>(null)
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
      setIsPaymentDialogOpen(false)
      paymentForm.reset()
      return
    }
    const clientId = Number(value)
    setSelectedClientId(clientId)
    await loadAccount(clientId)
  }

  async function handleCreatePayment(values: PaymentFormValues): Promise<void> {
    if (!selectedClientId) return
    const result = editingPaymentId
      ? await window.api.updateClientPayment({
          id: editingPaymentId,
          clientId: selectedClientId,
          ...values
        })
      : await window.api.createClientPayment({ clientId: selectedClientId, ...values })

    if (result.ok) {
      paymentForm.reset()
      setEditingPaymentId(null)
      setIsPaymentDialogOpen(false)
      await loadAccount(selectedClientId)
    } else {
      result.errors.forEach((error) => {
        if (error.field in values)
          paymentForm.setError(error.field as keyof PaymentFormValues, { message: error.message })
      })
    }
  }

  function startEditingPayment(payment: {
    id: number
    entryDate: string
    amount: number
    notes: string | null
  }): void {
    setEditingPaymentId(payment.id)
    paymentForm.reset({
      entryDate: payment.entryDate,
      amount: payment.amount,
      notes: payment.notes ?? ''
    })
    setIsPaymentDialogOpen(true)
  }

  async function handleDeletePayment(payment: { id: number }): Promise<void> {
    if (!confirm(t('clientAccount.deleteConfirmation', { id: payment.id }))) return
    const result = await window.api.deleteClientPayment({ id: payment.id })
    if (result.ok && selectedClientId) {
      if (editingPaymentId === payment.id) {
        setEditingPaymentId(null)
        paymentForm.reset()
      }
      await loadAccount(selectedClientId)
    }
  }

  return (
    <AccountCard title={t('clientAccount.title')}>
      <Select
        value={selectedClientId ? String(selectedClientId) : emptyValue}
        onValueChange={(value) => void handleChange(value)}
      >
        <SelectTrigger>
          <SelectValue placeholder={t('clientAccount.selectClient')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={emptyValue}>{t('clientAccount.selectClient')}</SelectItem>
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
              { label: t('clientAccount.summary.receivable'), value: account.receivableTotal },
              { label: t('clientAccount.summary.totalQuantity'), value: account.totalCubic },
              { label: t('clientAccount.summary.paid'), value: account.paidTotal },
              { label: t('clientAccount.summary.balance'), value: account.balance, highlight: true }
            ]}
          />
          <DataTable
            columns={getClientPaymentColumns({
              onEdit: startEditingPayment,
              onDelete: handleDeletePayment
            })}
            data={account.payments}
            getRowId={(payment) => String(payment.id)}
            enableRowSelection
            sumColumnId="amount"
          />
          <Dialog
            open={isPaymentDialogOpen}
            onOpenChange={(open) => {
              setIsPaymentDialogOpen(open)
              if (!open) {
                setEditingPaymentId(null)
                paymentForm.reset()
              }
            }}
          >
            <DialogTrigger asChild>
              <Button
                type="button"
                className="w-fit"
                onClick={() => {
                  setEditingPaymentId(null)
                  paymentForm.reset()
                }}
              >
                {t('clientAccount.addPayment')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingPaymentId
                    ? t('clientAccount.editPayment')
                    : t('clientAccount.addPayment')}
                </DialogTitle>
              </DialogHeader>
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
                        <FormLabel>{t('clientAccount.fields.paymentDate')}</FormLabel>
                        <FormControl>
                          <DatePicker
                            value={field.value}
                            onChange={field.onChange}
                            placeholder={t('clientAccount.placeholders.paymentDate')}
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
                        <FormLabel>{t('common.columns.amount')}</FormLabel>
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
                        <FormLabel>{t('common.columns.notes')}</FormLabel>
                        <FormControl>
                          <Textarea {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter className="md:col-span-2">
                    <Button type="submit">
                      {editingPaymentId
                        ? t('contractorsSettings.saveEdit')
                        : t('clientAccount.submitPayment')}
                    </Button>
                    <DialogClose asChild>
                      <Button type="button" variant="outline">
                        {t('common.cancel')}
                      </Button>
                    </DialogClose>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{t('clientAccount.selectClientHint')}</p>
      )}
    </AccountCard>
  )
}
