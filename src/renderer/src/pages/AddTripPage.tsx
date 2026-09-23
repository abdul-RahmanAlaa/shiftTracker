/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, ChevronsUpDown } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { useOutletContext } from 'react-router-dom'
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
import type { AddLog } from '@/App'
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
    tripDate: z.string().min(1, 'تاريخ النقلة مطلوب'),
    crusherCubic: z.number().nonnegative('تكعيب الكسارة مطلوب'),
    clientCubicReported: z.number().nonnegative('تكعيب العميل مطلوب'),
    discountQty: z.number().nonnegative().optional(),
    discountReason: z.string().optional(),
    location: z.string().optional(),
    crusherId: z.number().int().positive('الكسارة مطلوبة'),
    stonePrice: z.number().nonnegative('سعر الحجر مطلوب'),
    crusherReceiptStatus: z.enum(['قيمة', 'مفيش (متأكد)', 'مش معروف']),
    crusherReceiptNo: z.number().int().positive('رقم إيصال الكسارة مطلوب').optional(),
    clientId: z.number().int().positive('العميل مطلوب'),
    transportPrice: z.number().nonnegative('سعر النقل مطلوب'),
    clientPrice: z.number().nonnegative('سعر العميل مطلوب'),
    recipientNameStatus: z.enum(['قيمة', 'مش واضح']),
    recipientName: z.string().optional(),
    clientReceiptNo: z.string().optional(),
    notes: z.string().optional()
  })
  .superRefine((values, context) => {
    if (values.crusherReceiptStatus === 'قيمة' && !values.crusherReceiptNo) {
      context.addIssue({
        code: 'custom',
        path: ['crusherReceiptNo'],
        message: 'رقم إيصال الكسارة مطلوب'
      })
    }
    if (values.recipientNameStatus === 'قيمة' && !values.recipientName?.trim()) {
      context.addIssue({ code: 'custom', path: ['recipientName'], message: 'اسم المستلم مطلوب' })
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
  const { addLog } = useOutletContext<{ addLog: AddLog }>()
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
  const [showCreateShift, setShowCreateShift] = useState(false)
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
      recipientNameStatus: 'مش واضح',
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
    setShowCreateShift(false)
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

  async function handleCreateShift(values: CreateShiftValues): Promise<void> {
    if (!selectedDriverId) return
    const result = await window.api.createShift({ ...values, driverId: selectedDriverId })
    const message = result.ok
      ? `✅ وردية اتفتحت: ${result.data?.id}`
      : `❌ وردية: ${result.errors?.map((x) => x.message).join(', ')}`
    addLog(message)
    if (!result.ok) {
      result.errors.forEach((error) => {
        if (error.field in values)
          createShiftForm.setError(error.field as keyof CreateShiftValues, {
            message: error.message
          })
      })
      return
    }
    const shiftResult = await window.api.getDriverOpenShift({ driverId: selectedDriverId })
    if (shiftResult.ok && shiftResult.data) {
      setOpenShift(shiftResult.data)
      setShowCreateShift(false)
      syncTripDefaults(shiftResult.data)
    }
  }

  async function handleCreateTrip(values: TripValues): Promise<void> {
    if (!openShift) return
    const result = await window.api.createTrip({ shiftId: openShift.id, ...values })
    const message = result.ok
      ? `✅ نقلة اتضافت: ${result.data?.id}`
      : `❌ نقلة: ${result.errors?.map((x) => x.message).join(', ')}`
    setTripLog((previous) => [message, ...previous])
    addLog(message)
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
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-semibold">إضافة نقلة</h1>
        <p className="mt-1 text-sm text-muted-foreground">اختار السائق ثم أدخل بيانات النقلة</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>الخطوة 1: اختيار السائق</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={selectedDriverId ? String(selectedDriverId) : ''}
            onValueChange={(value) => void selectDriver(Number(value))}
            disabled={resourceLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder={resourceLoading ? 'جاري التحميل...' : 'اختار السائق'} />
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
            <CardTitle>الخطوة 2: حالة الوردية</CardTitle>
          </CardHeader>
          <CardContent>
            {checkingShift ? (
              <p className="text-sm text-muted-foreground">جاري التحميل...</p>
            ) : openShift ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-5">
                  <div>
                    <p className="text-sm text-muted-foreground">رقم الوردية</p>
                    <Badge variant="secondary">{openShift.id}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">رقم السيارة</p>
                    <p>{openShift.vehicleNo}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">تاريخ البداية</p>
                    <p>{openShift.startDate}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">تكعيب الكسارة</p>
                    <p>{openShift.crusherCubicDefault}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">تكعيب العميل</p>
                    <p>{openShift.clientCubicDefault}</p>
                  </div>
                </div>
                <Badge>وردية مفتوحة</Badge>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-amber-400">مفيش وردية مفتوحة لهذا السائق</p>
                <Button type="button" onClick={() => setShowCreateShift(true)}>
                  فتح وردية جديدة
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedDriverId && showCreateShift && !openShift && (
        <Card>
          <CardHeader>
            <CardTitle>فتح وردية جديدة</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateShiftForm
              form={createShiftForm}
              vehicles={resources.vehicles}
              onSubmit={handleCreateShift}
            />
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
            <CardTitle>سجل النقلات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
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
  const [locationOpen, setLocationOpen] = useState(false)

  return (
    <Card>
      <CardHeader>
        <CardTitle>الخطوة 3: بيانات النقلة</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="tripDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>تاريخ النقلة *</FormLabel>
                  <FormControl>
                    <DatePicker value={field.value} onChange={field.onChange} placeholder="اختر تاريخ النقلة" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <NumberField
              control={form.control}
              name="crusherCubic"
              label="تكعيب الكسارة"
              required
            />
            <NumberField
              control={form.control}
              name="clientCubicReported"
              label="تكعيب العميل"
              required
            />
            <NumberField control={form.control} name="discountQty" label="الخصم" />
            <FormField
              control={form.control}
              name="discountReason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>سبب الخصم</FormLabel>
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
                  <FormLabel>المكان</FormLabel>
                  <Popover open={locationOpen} onOpenChange={setLocationOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between font-normal"
                        >
                          {field.value || 'اختار أو اكتب المكان'}
                          <ChevronsUpDown className="h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="p-0">
                      <Command>
                        <CommandInput
                          value={field.value ?? ''}
                          onValueChange={field.onChange}
                          placeholder="اكتب المكان..."
                        />
                        <CommandList>
                          <CommandEmpty>اكتب قيمة جديدة أو اختار من القائمة</CommandEmpty>
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
                  <FormLabel>الكسارة *</FormLabel>
                  <Select
                    value={field.value ? String(field.value) : ''}
                    onValueChange={(value) => field.onChange(Number(value))}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="اختار الكسارة" />
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
            <NumberField control={form.control} name="stonePrice" label="سعر الحجر" required />
            <FormField
              control={form.control}
              name="crusherReceiptStatus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>إيصال الكسارة *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="قيمة">قيمة</SelectItem>
                      <SelectItem value="مفيش (متأكد)">مفيش (متأكد)</SelectItem>
                      <SelectItem value="مش معروف">مش معروف</SelectItem>
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
                label="رقم إيصال الكسارة"
                required
              />
            )}
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>العميل *</FormLabel>
                  <Select
                    value={field.value ? String(field.value) : ''}
                    onValueChange={(value) => field.onChange(Number(value))}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="اختار العميل" />
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
            <NumberField control={form.control} name="transportPrice" label="سعر النقل" required />
            <NumberField control={form.control} name="clientPrice" label="سعر العميل" required />
            <FormField
              control={form.control}
              name="recipientNameStatus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>اسم المستلم</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="قيمة">قيمة</SelectItem>
                      <SelectItem value="مش واضح">مش واضح</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {recipientNameStatus === 'قيمة' && (
              <FormField
                control={form.control}
                name="recipientName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>اسم المستلم *</FormLabel>
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
                  <FormLabel>رقم إيصال العميل</FormLabel>
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
                  <FormLabel>ملاحظات</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="md:col-span-2">
              <Button type="submit">إضافة النقلة</Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
