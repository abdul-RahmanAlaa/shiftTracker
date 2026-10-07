/* eslint-disable react-refresh/only-export-components */
import i18n from 'i18next'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/SubmitButton'
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
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { NumberField } from '@/pages/AddTripPage'
import type { ResourceState } from '@/pages/AddTripPage'

export const createShiftSchema = z.object({
  driverId: z.number().int().positive(i18n.t('createShift.validation.driverRequired')),
  vehicleNo: z.number().int().positive(i18n.t('createShift.validation.vehicleRequired')),
  crusherCubicDefault: z.number().positive(i18n.t('createShift.validation.crusherCubicRequired')),
  clientCubicDefault: z.number().positive(i18n.t('createShift.validation.clientCubicRequired')),
  startDate: z.string().min(1, i18n.t('createShift.validation.startDateRequired')),
  reportedDestination: z.string().optional(),
  notes: z.string().optional()
})

export type CreateShiftValues = z.infer<typeof createShiftSchema>

export function CreateShiftForm({
  form,
  drivers,
  vehicles,
  onSubmit,
  inline = false
}: {
  form: ReturnType<typeof useForm<CreateShiftValues>>
  drivers: ResourceState['drivers']
  vehicles: ResourceState['vehicles']
  onSubmit: (values: CreateShiftValues) => Promise<boolean>
  inline?: boolean
}): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const { t } = useTranslation()

  async function handleSubmit(values: CreateShiftValues): Promise<void> {
    const created = await onSubmit(values)
    if (created) setIsOpen(false)
  }

  const fields = (
    <>
      <FormField
        control={form.control}
        name="driverId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('createShift.fields.driver')}</FormLabel>
            <Select
              value={field.value ? String(field.value) : ''}
              onValueChange={(value) => field.onChange(Number(value))}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder={t('createShift.placeholders.driver')} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
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
        control={form.control}
        name="vehicleNo"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('createShift.fields.vehicle')}</FormLabel>
            <Select
              value={field.value ? String(field.value) : ''}
              onValueChange={(value) => field.onChange(Number(value))}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder={t('createShift.placeholders.vehicle')} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {vehicles.map((vehicle) => (
                  <SelectItem key={vehicle.vehicleNo} value={String(vehicle.vehicleNo)}>
                    {vehicle.vehicleNo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <NumberField
        control={form.control}
        name="crusherCubicDefault"
        label={t('createShift.fields.crusherCubic')}
        required
      />
      <NumberField
        control={form.control}
        name="clientCubicDefault"
        label={t('createShift.fields.clientCubic')}
        required
      />
      <FormField
        control={form.control}
        name="startDate"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('createShift.fields.startDate')}</FormLabel>
            <FormControl>
              <DatePicker
                value={field.value}
                onChange={field.onChange}
                placeholder={t('createShift.placeholders.startDate')}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="reportedDestination"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('createShift.fields.destination')}</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
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
    </>
  )

  const formContent = (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="grid gap-4 md:grid-cols-2">
        {fields}
        {inline ? (
          <div className="md:col-span-2">
            <SubmitButton isSubmitting={form.formState.isSubmitting}>
              {t('createShift.submit')}
            </SubmitButton>
          </div>
        ) : (
          <DialogFooter className="md:col-span-2">
            <SubmitButton isSubmitting={form.formState.isSubmitting}>
              {t('createShift.submit')}
            </SubmitButton>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={form.formState.isSubmitting}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
          </DialogFooter>
        )}
      </form>
    </Form>
  )

  if (inline) return formContent

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open)
        if (!open) form.reset()
      }}
    >
      <DialogTrigger asChild>
        <Button type="button">{t('createShift.title')}</Button>
      </DialogTrigger>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
        closeDisabled={form.formState.isSubmitting}
      >
        <DialogHeader>
          <DialogTitle>{t('createShift.title')}</DialogTitle>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  )
}
