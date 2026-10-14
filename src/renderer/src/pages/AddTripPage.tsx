/* eslint-disable react-refresh/only-export-components */
import { ipcApi } from '@/lib/ipcErrors'
import { useEffect, useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, ChevronsUpDown } from 'lucide-react'
import i18n from 'i18next'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/SubmitButton'
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
import { hasAtMostTwoDecimals } from '@/lib/money'
import { createLatestGuard } from '@/lib/latestGuard'
import { TripEntryGrid } from '@/components/TripEntryGrid'
import type { TripGridPayload } from '@/lib/tripGrid'

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
  materialTypes: NamedOption[]
  locations: string[]
}

export const tripSchema = z
  .object({
    tripDate: z.string().min(1, i18n.t('tripForm.validation.tripDateRequired')),
    crusherCubic: z.number().positive(i18n.t('tripForm.validation.crusherCubicRequired')),
    clientCubicReported: z.number().positive(i18n.t('tripForm.validation.clientCubicRequired')),
    fineAmount: z
      .number()
      .nonnegative(i18n.t('tripForm.validation.fineAmountNonNegative'))
      .refine(hasAtMostTwoDecimals, i18n.t('common.validation.moneyDecimals'))
      .optional(),
    fineReason: z.string().optional(),
    location: z.string().optional(),
    crusherId: z.number().int().positive(i18n.t('tripForm.validation.crusherRequired')),
    stonePrice: z
      .number()
      .positive(i18n.t('tripForm.validation.stonePriceRequired'))
      .refine(hasAtMostTwoDecimals, i18n.t('common.validation.moneyDecimals')),
    crusherReceiptStatus: z.enum(['PROVIDED', 'CONFIRMED_MISSING', 'UNKNOWN']),
    crusherReceiptNo: z
      .number()
      .int()
      .positive(i18n.t('tripForm.validation.crusherReceiptNumberRequired'))
      .optional(),
    clientId: z.number().int().positive(i18n.t('tripForm.validation.clientRequired')),
    materialTypeId: z.number().int().positive(i18n.t('tripForm.validation.materialTypeRequired')),
    transportPrice: z
      .number()
      .positive(i18n.t('tripForm.validation.transportPriceRequired'))
      .refine(hasAtMostTwoDecimals, i18n.t('common.validation.moneyDecimals')),
    clientPrice: z
      .number()
      .positive(i18n.t('tripForm.validation.clientPriceRequired'))
      .refine(hasAtMostTwoDecimals, i18n.t('common.validation.moneyDecimals')),
    recipientNameStatus: z.enum(['PROVIDED', 'UNCLEAR']),
    recipientName: z.string().optional(),
    clientReceiptNo: z.string().optional(),
    notes: z.string().optional()
  })
  .superRefine((values, context) => {
    if (values.crusherReceiptStatus === 'PROVIDED' && !values.crusherReceiptNo) {
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

function validateTripGridPayload(payload: TripGridPayload): { field: string; message: string }[] {
  const parsed = tripSchema.safeParse(payload)
  return parsed.success
    ? []
    : parsed.error.issues.map((issue) => ({
        field: String(issue.path[0] ?? '_form'),
        message: issue.message
      }))
}

export function NumberField({
  control,
  name,
  label,
  required = false,
  money = false
}: {
  control:
    | ReturnType<typeof useForm<CreateShiftValues>>['control']
    | ReturnType<typeof useForm<TripValues>>['control']
  name: string
  label: string
  required?: boolean
  money?: boolean
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
              step={money ? '0.01' : 'any'}
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
    materialTypes: [],
    locations: []
  })
  const [selectedDriverId, setSelectedDriverId] = useState<number | undefined>(undefined)
  const [openShift, setOpenShift] = useState<OpenShift | null | undefined>(undefined)
  const [shiftTripCount, setShiftTripCount] = useState(0)
  const [checkingShift, setCheckingShift] = useState(false)
  const [resourceLoading, setResourceLoading] = useState(true)
  const selectedDriverRef = useRef<number | undefined>(undefined)
  const driverGuard = useRef(createLatestGuard())

  const createShiftForm = useForm<CreateShiftValues>({
    resolver: zodResolver(createShiftSchema),
    defaultValues: {
      driverId: undefined,
      vehicleNo: undefined,
      crusherCubicDefault: 0,
      clientCubicDefault: 0,
      startDate: '',
      reportedDestination: '',
      notes: ''
    }
  })

  useEffect(() => {
    void Promise.all([
      ipcApi.listDrivers(),
      ipcApi.listVehicles(),
      ipcApi.listCrushers(),
      ipcApi.listClients(),
      ipcApi.listMaterialTypes(),
      ipcApi.listTripLocations()
    ]).then(([drivers, vehicles, crushers, clients, materialTypes, locations]) => {
      setResources({
        drivers: drivers.ok ? drivers.data : [],
        vehicles: vehicles.ok ? vehicles.data : [],
        crushers: crushers.ok ? crushers.data : [],
        clients: clients.ok ? clients.data : [],
        materialTypes: materialTypes.ok ? materialTypes.data : [],
        locations: locations.ok ? locations.data : []
      })
      setResourceLoading(false)
    })
  }, [])

  useEffect(() => () => driverGuard.current.cancel(), [])

  async function loadDriverShift(driverId: number): Promise<void> {
    const token = driverGuard.current.next()
    setCheckingShift(true)
    const result = await ipcApi.getDriverOpenShift({ driverId })
    if (!driverGuard.current.isLatest(token)) return
    if (result.ok && result.data) {
      setOpenShift(result.data)
      const trips = await ipcApi.listTripsByShift({ shiftId: result.data.id })
      if (!driverGuard.current.isLatest(token)) return
      setShiftTripCount(trips.ok ? trips.data.length : 0)
    } else {
      setOpenShift(null)
      setShiftTripCount(0)
    }
    setCheckingShift(false)
  }

  async function selectDriver(value: string): Promise<void> {
    if (!value) {
      driverGuard.current.cancel()
      selectedDriverRef.current = undefined
      setSelectedDriverId(undefined)
      setOpenShift(undefined)
      setShiftTripCount(0)
      setCheckingShift(false)
      return
    }
    const driverId = Number(value)
    selectedDriverRef.current = driverId
    setSelectedDriverId(driverId)
    createShiftForm.setValue('driverId', driverId)
    setOpenShift(null)
    await loadDriverShift(driverId)
  }

  async function handleCreateShift(values: CreateShiftValues): Promise<boolean> {
    if (!values.driverId) return false
    const result = await ipcApi.createShift(values)
    if (!result.ok) {
      result.errors.forEach((error) => {
        if (error.field in values)
          createShiftForm.setError(error.field as keyof CreateShiftValues, {
            message: error.message
          })
      })
      return false
    }
    const currentDriverId = selectedDriverRef.current
    if (currentDriverId !== undefined) await loadDriverShift(currentDriverId)
    return true
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden" dir="rtl">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-56 flex-1 items-center gap-3">
          <div>
            <h1 className="text-xl font-semibold">{t('addTrip.title')}</h1>
            <p className="text-xs text-muted-foreground">{t('addTrip.subtitle')}</p>
          </div>
          <Select
            value={selectedDriverId ? String(selectedDriverId) : ''}
            onValueChange={(value) => void selectDriver(value)}
            disabled={resourceLoading}
          >
            <SelectTrigger className="w-48">
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
          {selectedDriverId !== undefined && (
            <Button type="button" size="sm" variant="ghost" onClick={() => void selectDriver('')}>
              {t('tripGrid.clearDriver')}
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {openShift && (
            <>
              <Badge variant="secondary">{openShift.id}</Badge>
              <Badge variant="outline">{openShift.vehicleNo}</Badge>
              <Badge variant="outline">{openShift.startDate}</Badge>
              <Badge variant="outline">
                {t('tripGrid.shiftTripCount', { count: shiftTripCount })}
              </Badge>
            </>
          )}
          <Badge variant={selectedDriverId ? 'secondary' : 'outline'}>
            {t('tripGrid.stepDriver')}
          </Badge>
          <Badge variant={openShift ? 'secondary' : 'outline'}>{t('tripGrid.stepTrips')}</Badge>
        </div>
      </header>

      {checkingShift && (
        <p className="shrink-0 text-sm text-muted-foreground">{t('common.loading')}</p>
      )}

      {selectedDriverId !== undefined && !checkingShift && !openShift && (
        <Card className="shrink-0">
          <CardContent className="flex flex-wrap items-center gap-4 py-4">
            <p className="text-sm text-amber-400">{t('addTrip.noOpenShift')}</p>
            <CreateShiftForm
              form={createShiftForm}
              drivers={resources.drivers}
              vehicles={resources.vehicles}
              onSubmit={handleCreateShift}
            />
          </CardContent>
        </Card>
      )}

      {openShift && (
        <TripEntryGrid
          shift={openShift}
          resources={resources}
          validateTripPayload={validateTripGridPayload}
          onRefresh={() => {
            const currentDriverId = selectedDriverRef.current
            return currentDriverId === undefined
              ? Promise.resolve()
              : loadDriverShift(currentDriverId)
          }}
        />
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
