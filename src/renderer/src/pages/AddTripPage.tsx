/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, ChevronsUpDown } from 'lucide-react'
import i18n from 'i18next'
import { useTranslation } from 'react-i18next'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CreateShiftForm, createShiftSchema } from '@/components/CreateShiftForm'
import type { CreateShiftValues } from '@/components/CreateShiftForm'
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
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

type NamedOption = { id: number; name: string }
type OpenShift = {
  id: string
  vehicleNo: number
  driverId: number
  crusherCubicDefault: number
  clientCubicDefault: number
  status: string
  startDate: string
  endDate: string | null
}

export type ResourceState = {
  drivers: NamedOption[]
  vehicles: { vehicleNo: number; trailerNo: number; contractorId: number }[]
  crushers: NamedOption[]
  clients: NamedOption[]
  locations: string[]
}

export const tripSchema = z
  .object({
    tripDate: z.string().min(1, i18n.t('tripForm.validation.tripDateRequired')),
    crusherCubic: z.number().nonnegative(i18n.t('tripForm.validation.crusherCubicRequired')),
    clientCubicReported: z.number().nonnegative(i18n.t('tripForm.validation.clientCubicRequired')),
    discountQty: z.number().nonnegative().optional(),
    discountReason: z.string().optional(),
    location: z.string().optional(),
    crusherId: z.number().int().positive(i18n.t('tripForm.validation.crusherRequired')),
    stonePrice: z.number().nonnegative(i18n.t('tripForm.validation.stonePriceRequired')),
    crusherReceiptStatus: z.enum(['قيمة', 'مفيش (متأكد)', 'مش معروف']),
    crusherReceiptNo: z
      .number()
      .int()
      .positive(i18n.t('tripForm.validation.crusherReceiptNumberRequired'))
      .optional(),
    clientId: z.number().int().positive(i18n.t('tripForm.validation.clientRequired')),
    transportPrice: z.number().nonnegative(i18n.t('tripForm.validation.transportPriceRequired')),
    clientPrice: z.number().nonnegative(i18n.t('tripForm.validation.clientPriceRequired')),
    recipientNameStatus: z.enum(['PROVIDED', 'UNCLEAR']),
    recipientName: z.string().optional(),
    clientReceiptNo: z.string().optional(),
    notes: z.string().optional()
  })
  .superRefine((values, context) => {
    if (values.crusherReceiptStatus === 'قيمة' && !values.crusherReceiptNo) {
      context.addIssue({
        code: 'custom',
        path: ['crusherReceiptNo'],
        message: i18n.t('tripForm.validation.crusherReceiptNumberRequired')
      })
    }
    if (values.recipientNameStatus === 'PROVIDED' && !values.recipientName?.trim()) {
      context.addIssue({
        code: 'custom',
        path: ['recipientName'],
        message: i18n.t('tripForm.validation.recipientNameRequired')
      })
    }
  })

export type TripValues = z.infer<typeof tripSchema>

export function NumberField({
  control,
  name,
  label,
  required = false
}: {
  control:
    | ReturnType<typeof useForm<CreateShiftValues>>['control']
    | ReturnType<typeof useForm<TripValues>>['control']
  name: string
  label: string
  required?: boolean
}): React.JSX.Element {
  return (
    <FormField
      control={control as never}
      name={name as never}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label}
            {required ? ' *' : ''}
          </FormLabel>
          <FormControl>
            <Input
              type="number"
              value={field.value ?? ''}
              onChange={(event) =>
                field.onChange(event.target.value === '' ? undefined : Number(event.target.value))
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export function AddTripPage(): React.JSX.Element {
  const { t } = useTranslation()
  const [resources, setResources] = useState<ResourceState>({
    drivers: [],
    vehicles: [],
    crushers: [],
    clients: [],
    locations: []
  })
  const [selectedDriverId, setSelectedDriverId] = useState<number>()
  const [openShift, setOpenShift] = useState<OpenShift | null>()
  const [checkingShift, setCheckingShift] = useState(false)
  const [resourceLoading, setResourceLoading] = useState(true)
  const [tripLog, setTripLog] = useState<string[]>([])

  const createShiftForm = useForm<CreateShiftValues>({
    resolver: zodResolver(createShiftSchema),
    defaultValues: {
      vehicleNo: undefined,
      crusherCubicDefault: 0,
      clientCubicDefault: 0,
      startDate: '',
      reportedDestination: '',
      reportedTripCount: undefined,
      notes: ''
    }
  })

  const tripForm = useForm<TripValues>({
    resolver: zodResolver(tripSchema),
    defaultValues: {
      tripDate: '',
      crusherCubic: 0,
      clientCubicReported: 0,
      discountQty: 0,
      discountReason: '',
      location: '',
      crusherId: undefined,
      stonePrice: undefined,
      crusherReceiptStatus: 'مش معروف',
      crusherReceiptNo: undefined,
      clientId: undefined,
      transportPrice: undefined,
      clientPrice: undefined,
      recipientNameStatus: 'UNCLEAR',
      recipientName: '',
      clientReceiptNo: '',
      notes: ''
    }
  })

  const crusherReceiptStatus = useWatch({ control: tripForm.control, name: 'crusherReceiptStatus' })
  const recipientNameStatus = useWatch({ control: tripForm.control, name: 'recipientNameStatus' })

  useEffect(() => {
    void Promise.all([
      window.api.listDrivers(),
      window.api.listVehicles(),
      window.api.listCrushers(),
      window.api.listClients(),
      window.api.listTripLocations()
    ]).then(([drivers, vehicles, crushers, clients, locations]) => {
      setResources({
        drivers: drivers.ok ? drivers.data : [],
        vehicles: vehicles.ok ? vehicles.data : [],
        crushers: crushers.ok ? crushers.data : [],
        clients: clients.ok ? clients.data : [],
        locations: locations.ok ? locations.data : []
      })
      setResourceLoading(false)
    })
  }, [])

  async function selectDriver(driverId: number): Promise<void> {
    setSelectedDriverId(driverId)
    setCheckingShift(true)
    const result = await window.api.getDriverOpenShift({ driverId })
    if (result.ok && result.data) {
      setOpenShift(result.data)
      syncTripDefaults(result.data)
    } else {
      setOpenShift(null)
    }
    setCheckingShift(false)
  }

  function syncTripDefaults(shift: OpenShift): void {
    tripForm.reset({
      ...tripForm.getValues(),
      crusherCubic: shift.crusherCubicDefault,
      clientCubicReported: shift.clientCubicDefault
    })
  }

  async function handleCreateShift(values: CreateShiftValues): Promise<boolean> {
    if (!selectedDriverId) return false
    const result = await window.api.createShift({ ...values, driverId: selectedDriverId })
    if (!result.ok) {
      result.errors.forEach((error) => {
        if (error.field in values)
          createShiftForm.setError(error.field as keyof CreateShiftValues, {
            message: error.message
          })
      })
      return false
    }
    const shiftResult = await window.api.getDriverOpenShift({ driverId: selectedDriverId })
    if (shiftResult.ok && shiftResult.data) {
      setOpenShift(shiftResult.data)
      syncTripDefaults(shiftResult.data)
      return true
    }
    return false
  }

  async function handleCreateTrip(values: TripValues): Promise<void> {
    if (!openShift) return
    const result = await window.api.createTrip({ shiftId: openShift.id, ...values })
    const message = result.ok
      ? t('addTrip.logs.created', { id: result.data?.id })
      : t('addTrip.logs.failed', { errors: result.errors?.map((x) => x.message).join(', ') })
    setTripLog((previous) => [message, ...previous])
    if (result.ok) {
      tripForm.reset({
        ...tripForm.getValues(),
        tripDate: '',
        discountQty: 0,
        discountReason: '',
        crusherReceiptNo: undefined,
        recipientName: '',
        clientReceiptNo: '',
        notes: ''
      })
    } else {
      result.errors.forEach((error) => {
        if (error.field in values)
          tripForm.setError(error.field as keyof TripValues, { message: error.message })
      })
    }
  }

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-semibold">{t('addTrip.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('addTrip.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('addTrip.steps.selectDriver')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={selectedDriverId ? String(selectedDriverId) : ''}
            onValueChange={(value) => void selectDriver(Number(value))}
            disabled={resourceLoading}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={resourceLoading ? t('common.loading') : t('addTrip.selectDriver')}
              />
            </SelectTrigger>
            <SelectContent>
              {resources.drivers.map((driver) => (
                <SelectItem key={driver.id} value={String(driver.id)}>
                  {driver.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedDriverId && (
        <Card>
          <CardHeader>
            <CardTitle>{t('addTrip.steps.shiftStatus')}</CardTitle>
          </CardHeader>
          <CardContent>
            {checkingShift ? (
              <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
            ) : openShift ? (
              <div className="flex flex-col gap-4">
                <div className="grid gap-3 sm:grid-cols-5">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('shifts.shiftInfo.number')}</p>
                    <Badge variant="secondary">{openShift.id}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t('vehiclesSettings.fields.vehicleNo')}
                    </p>
                    <p>{openShift.vehicleNo}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t('shifts.shiftInfo.startDate')}
                    </p>
                    <p>{openShift.startDate}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t('createShift.fields.crusherCubic')}
                    </p>
                    <p>{openShift.crusherCubicDefault}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t('createShift.fields.clientCubic')}
                    </p>
                    <p>{openShift.clientCubicDefault}</p>
                  </div>
                </div>
                <Badge>{t('shiftStatus.open')}</Badge>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-amber-400">{t('addTrip.noOpenShift')}</p>
                <CreateShiftForm
                  form={createShiftForm}
                  vehicles={resources.vehicles}
                  onSubmit={handleCreateShift}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {openShift && (
        <TripForm
          form={tripForm}
          resources={resources}
          locations={resources.locations}
          crusherReceiptStatus={crusherReceiptStatus}
          recipientNameStatus={recipientNameStatus}
          onSubmit={handleCreateTrip}
        />
      )}

      {tripLog.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('addTrip.tripLogTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2 text-sm">
              {tripLog.map((line, index) => (
                <div key={`${line}-${index}`}>{line}</div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

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
              name="discountQty"
              label={t('tripForm.fields.discount')}
            />
            <FormField
              control={form.control}
              name="discountReason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('tripForm.fields.discountReason')}</FormLabel>
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
                      <SelectItem value="قيمة">{t('tripForm.receiptStatuses.value')}</SelectItem>
                      <SelectItem value="مفيش (متأكد)">
                        {t('tripForm.receiptStatuses.noReceiptConfirmed')}
                      </SelectItem>
                      <SelectItem value="مش معروف">
                        {t('tripForm.receiptStatuses.unknown')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {crusherReceiptStatus === 'قيمة' && (
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
            <NumberField
              control={form.control}
              name="transportPrice"
              label={t('tripForm.fields.transportPrice')}
              required
            />
            <NumberField
              control={form.control}
              name="clientPrice"
              label={t('tripForm.fields.clientPrice')}
              required
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
                      <SelectItem value="PROVIDED">{t('tripForm.receiptStatuses.value')}</SelectItem>
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
              <Button type="submit">{t('tripForm.submit')}</Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
