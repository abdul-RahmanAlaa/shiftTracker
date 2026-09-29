/* eslint-disable react-refresh/only-export-components */
import i18n from 'i18next'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { UseFormReturn } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { DialogClose, DialogFooter } from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

export const ledgerEntrySchema = z.object({
  entryDate: z.string().min(1, i18n.t('ledgerEntryForm.validation.dateRequired')),
  driverId: z.number().int().positive().optional(),
  movementType: z.enum(['عهدة', 'دفعة', 'اخرى'], {
    message: i18n.t('ledgerEntryForm.validation.movementTypeRequired')
  }),
  amount: z.number({ message: i18n.t('ledgerEntryForm.validation.amountRequired') }),
  shiftId: z.string().optional(),
  contractorId: z.number().int().positive().optional(),
  notes: z.string().optional()
})

export type LedgerEntryFormValues = z.infer<typeof ledgerEntrySchema>

type LedgerEntryFormProps = {
  form: UseFormReturn<LedgerEntryFormValues>
  onSubmit: (values: LedgerEntryFormValues) => Promise<void>
  drivers: { id: number; name: string }[]
  contractors: { id: number; name: string }[]
  shifts: { id: string; status: string }[]
  submitLabel: string
  lockedContractorId?: number
  lockedDriverId?: number
  requireContractorId?: boolean
}

const emptyValue = '__none__'

export function LedgerEntryForm({
  form,
  onSubmit,
  drivers,
  contractors,
  shifts,
  submitLabel,
  lockedContractorId,
  lockedDriverId,
  requireContractorId = false
}: LedgerEntryFormProps): React.JSX.Element {
  const { t } = useTranslation()

  useEffect(() => {
    if (lockedContractorId !== undefined) {
      form.setValue('contractorId', lockedContractorId)
    }
    if (lockedDriverId !== undefined) {
      form.setValue('driverId', lockedDriverId)
    }
  }, [form, lockedContractorId, lockedDriverId])

  async function handleSubmit(values: LedgerEntryFormValues): Promise<void> {
    const submittedValues = {
      ...values,
      contractorId: lockedContractorId ?? values.contractorId,
      driverId: lockedDriverId ?? values.driverId
    }

    if (requireContractorId && !submittedValues.contractorId) {
      form.setError('contractorId', { message: t('ledgerEntryForm.validation.contractorRequired') })
      return
    }

    await onSubmit(submittedValues)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="grid gap-4 md:grid-cols-2">
        <FormField
          control={form.control}
          name="entryDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('ledgerEntryForm.fields.date')}</FormLabel>
              <FormControl>
                <DatePicker
                  value={field.value}
                  onChange={field.onChange}
                  placeholder={t('ledgerEntryForm.placeholders.date')}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="movementType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('ledgerEntryForm.fields.movementType')}</FormLabel>
              <Select value={field.value ?? ''} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t('ledgerEntryForm.placeholders.movementType')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="عهدة">{t('ledgerEntryForm.movementTypes.custody')}</SelectItem>
                  <SelectItem value="دفعة">{t('ledgerEntryForm.movementTypes.payment')}</SelectItem>
                  <SelectItem value="اخرى">{t('ledgerEntryForm.movementTypes.other')}</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
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
          control={form.control}
          name="driverId"
          render={({ field }) => {
            const driverId = lockedDriverId ?? field.value

            return (
              <FormItem>
                <FormLabel>{t('ledgerEntryForm.fields.driver')}</FormLabel>
                <Select
                  disabled={lockedDriverId !== undefined}
                  value={driverId ? String(driverId) : emptyValue}
                  onValueChange={(value) =>
                    field.onChange(value === emptyValue ? undefined : Number(value))
                  }
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t('ledgerEntryForm.none.driver')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={emptyValue}>{t('ledgerEntryForm.none.driver')}</SelectItem>
                    {drivers.map((driver) => (
                      <SelectItem key={driver.id} value={String(driver.id)}>
                        {driver.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )
          }}
        />
        <FormField
          control={form.control}
          name="shiftId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('ledgerEntryForm.fields.shift')}</FormLabel>
              <Select
                value={field.value ?? emptyValue}
                onValueChange={(value) => field.onChange(value === emptyValue ? undefined : value)}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t('ledgerEntryForm.none.shift')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={emptyValue}>{t('ledgerEntryForm.none.shift')}</SelectItem>
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
          control={form.control}
          name="contractorId"
          render={({ field }) => {
            const contractorId = lockedContractorId ?? field.value

            return (
              <FormItem>
                <FormLabel>{t('ledgerEntryForm.fields.contractor')}</FormLabel>
                <Select
                  disabled={lockedContractorId !== undefined}
                  value={contractorId ? String(contractorId) : emptyValue}
                  onValueChange={(value) =>
                    field.onChange(value === emptyValue ? undefined : Number(value))
                  }
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          requireContractorId
                            ? t('ledgerEntryForm.placeholders.contractor')
                            : t('ledgerEntryForm.none.contractor')
                        }
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {!requireContractorId && lockedContractorId === undefined && (
                      <SelectItem value={emptyValue}>
                        {t('ledgerEntryForm.none.contractor')}
                      </SelectItem>
                    )}
                    {contractors.map((contractor) => (
                      <SelectItem key={contractor.id} value={String(contractor.id)}>
                        {contractor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )
          }}
        />
        <FormField
          control={form.control}
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
          <Button type="submit">{submitLabel}</Button>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {t('common.cancel')}
            </Button>
          </DialogClose>
        </DialogFooter>
      </form>
    </Form>
  )
}
