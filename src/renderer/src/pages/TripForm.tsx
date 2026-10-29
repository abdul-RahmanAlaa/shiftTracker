import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { SubmitButton } from '@/components/SubmitButton'
import { NumberField } from './NumberField'
import { cn } from '@/lib/utils'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { ResourceState, TripValues } from './tripFormSchema'

export function TripForm({
  form,
  resources,
  locations,
  crusherReceiptStatus,
  recipientNameStatus,
  onSubmit
}: {
  form: ReturnType<typeof useForm<TripValues>>
  resources: ResourceState
  locations: string[]
  crusherReceiptStatus: TripValues['crusherReceiptStatus']
  recipientNameStatus: TripValues['recipientNameStatus']
  onSubmit: (values: TripValues) => Promise<void>
}): React.JSX.Element {
  const { t } = useTranslation()
  const [locationOpen, setLocationOpen] = useState(false)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('addTrip.steps.tripDetails')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="tripDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('tripForm.fields.tripDate')}
                    {' *'}
                  </FormLabel>
                  <FormControl>
                    <DatePicker
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={t('tripForm.placeholders.tripDate')}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <NumberField
              control={form.control}
              name="crusherCubic"
              label={t('tripForm.fields.crusherCubic')}
              required
            />
            <NumberField
              control={form.control}
              name="clientCubicReported"
              label={t('tripForm.fields.clientCubic')}
              required
            />
            <NumberField
              control={form.control}
              name="fineAmount"
              label={t('tripForm.fields.fineAmount')}
              money
            />
            <FormField
              control={form.control}
              name="fineReason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('tripForm.fields.fineReason')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('tripForm.fields.location')}</FormLabel>
                  <Popover open={locationOpen} onOpenChange={setLocationOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between font-normal"
                        >
                          {field.value || t('tripForm.placeholders.location')}
                          <ChevronsUpDown className="h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="p-0">
                      <Command>
                        <CommandInput
                          value={field.value ?? ''}
                          onValueChange={field.onChange}
                          placeholder={t('tripForm.placeholders.typeLocation')}
                        />
                        <CommandList>
                          <CommandEmpty>{t('tripForm.locationEmpty')}</CommandEmpty>
                          {locations.map((location) => (
                            <CommandItem
                              key={location}
                              value={location}
                              onSelect={(value) => {
                                field.onChange(value)
                                setLocationOpen(false)
                              }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  field.value === location ? 'opacity-100' : 'opacity-0'
                                )}
                              />
                              {location}
                            </CommandItem>
                          ))}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="crusherId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('tripForm.fields.crusher')}
                    {' *'}
                  </FormLabel>
                  <Select
                    value={field.value ? String(field.value) : ''}
                    onValueChange={(value) => field.onChange(Number(value))}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('tripForm.placeholders.crusher')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {resources.crushers.map((crusher) => (
                        <SelectItem key={crusher.id} value={String(crusher.id)}>
                          {crusher.name}
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
              name="stonePrice"
              label={t('tripForm.fields.stonePrice')}
              required
              money
            />
            <FormField
              control={form.control}
              name="crusherReceiptStatus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('tripForm.fields.crusherReceiptStatus')}
                    {' *'}
                  </FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="PROVIDED">
                        {t('tripForm.receiptStatuses.value')}
                      </SelectItem>
                      <SelectItem value="CONFIRMED_MISSING">
                        {t('tripForm.receiptStatuses.noReceiptConfirmed')}
                      </SelectItem>
                      <SelectItem value="UNKNOWN">
                        {t('tripForm.receiptStatuses.unknown')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {crusherReceiptStatus === 'PROVIDED' && (
              <NumberField
                control={form.control}
                name="crusherReceiptNo"
                label={t('tripForm.fields.crusherReceiptNumber')}
                required
              />
            )}
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('tripForm.fields.client')}
                    {' *'}
                  </FormLabel>
                  <Select
                    value={field.value ? String(field.value) : ''}
                    onValueChange={(value) => field.onChange(Number(value))}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('tripForm.placeholders.client')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {resources.clients.map((client) => (
                        <SelectItem key={client.id} value={String(client.id)}>
                          {client.name}
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
              name="materialTypeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('tripForm.fields.materialType')}
                    {' *'}
                  </FormLabel>
                  <Select
                    value={field.value ? String(field.value) : ''}
                    onValueChange={(value) => field.onChange(Number(value))}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('tripForm.placeholders.materialType')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {resources.materialTypes.map((materialType) => (
                        <SelectItem key={materialType.id} value={String(materialType.id)}>
                          {materialType.name}
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
              name="transportPrice"
              label={t('tripForm.fields.transportPrice')}
              required
              money
            />
            <NumberField
              control={form.control}
              name="clientPrice"
              label={t('tripForm.fields.clientPrice')}
              required
              money
            />
            <FormField
              control={form.control}
              name="recipientNameStatus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('tripForm.fields.recipientNameStatus')}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="PROVIDED">
                        {t('tripForm.receiptStatuses.value')}
                      </SelectItem>
                      <SelectItem value="UNCLEAR">
                        {t('tripForm.recipientNameStatuses.unclear')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {recipientNameStatus === 'PROVIDED' && (
              <FormField
                control={form.control}
                name="recipientName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t('tripForm.fields.recipientName')}
                      {' *'}
                    </FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="clientReceiptNo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('tripForm.fields.clientReceiptNumber')}</FormLabel>
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
            <div className="md:col-span-2">
              <SubmitButton isSubmitting={form.formState.isSubmitting}>
                {t('tripForm.submit')}
              </SubmitButton>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
