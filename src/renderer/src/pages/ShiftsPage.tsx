import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CreateShiftForm, createShiftSchema } from '@/components/CreateShiftForm'
import { TripReceiptPhoto } from '@/components/TripReceiptPhoto'
import { DataTable } from '@/components/DataTable'
import type { CreateShiftValues } from '@/components/CreateShiftForm'
import { DatePicker } from '@/components/ui/date-picker'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { TripForm, tripSchema } from './AddTripPage'
import type { ResourceState, TripValues } from './AddTripPage'

type TripRow = Extract<
  Awaited<ReturnType<typeof window.api.listTripsByShift>>,
  { ok: true }
>['data'][number]

type ShiftListRow = {
  id: string
  vehicleNo: number
  driverId: number
  driverName: string
  crusherCubicDefault: number
  clientCubicDefault: number
  status: string
  startDate: string
  endDate: string | null
  actualTripCount: number
}

export function ShiftsPage(): React.JSX.Element {
  const [shifts, setShifts] = useState<ShiftListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDriverIdForShift, setSelectedDriverIdForShift] = useState<number>()
  const [closeShiftId, setCloseShiftId] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null)
  const [shiftTrips, setShiftTrips] = useState<TripRow[]>([])
  const [editingTripId, setEditingTripId] = useState<string | null>(null)
  const [resources, setResources] = useState<ResourceState>({
    drivers: [],
    vehicles: [],
    crushers: [],
    clients: [],
    locations: []
  })
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

  const editTripForm = useForm<TripValues>({
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
  const editCrusherReceiptStatus = useWatch({
    control: editTripForm.control,
    name: 'crusherReceiptStatus'
  })
  const editRecipientNameStatus = useWatch({
    control: editTripForm.control,
    name: 'recipientNameStatus'
  })

  useEffect(() => {
    void window.api.listShifts().then((result) => {
      if (result.ok) setShifts(result.data)
      setLoading(false)
    })
  }, [])

  async function loadShifts(): Promise<void> {
    const result = await window.api.listShifts()
    if (result.ok) setShifts(result.data)
    setLoading(false)
  }

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
    })
  }, [])

  async function loadShiftTrips(shiftId: string): Promise<void> {
    const result = await window.api.listTripsByShift({ shiftId })
    setShiftTrips(result.ok ? result.data : [])
  }

  async function selectShift(shiftId: string): Promise<void> {
    setSelectedShiftId(shiftId)
    setEditingTripId(null)
    await loadShiftTrips(shiftId)
  }

  function startEditingTrip(trip: TripRow): void {
    setEditingTripId(trip.id)
    editTripForm.reset({
      tripDate: trip.tripDate,
      crusherCubic: trip.crusherCubic,
      clientCubicReported: trip.clientCubicReported,
      discountQty: trip.discountQty,
      discountReason: trip.discountReason ?? '',
      location: trip.location ?? '',
      crusherId: trip.crusherId,
      stonePrice: trip.stonePrice ?? undefined,
      crusherReceiptStatus: trip.crusherReceiptStatus as TripValues['crusherReceiptStatus'],
      crusherReceiptNo: trip.crusherReceiptNo ?? undefined,
      clientId: trip.clientId,
      transportPrice: trip.transportPrice,
      clientPrice: trip.clientPrice,
      recipientNameStatus: trip.recipientNameStatus as TripValues['recipientNameStatus'],
      recipientName: trip.recipientName ?? '',
      clientReceiptNo: trip.clientReceiptNo ?? '',
      notes: trip.notes ?? ''
    })
  }

  async function handleUpdateTrip(values: TripValues): Promise<void> {
    if (!editingTripId || !selectedShiftId) return
    const result = await window.api.updateTrip({ id: editingTripId, ...values })
    if (result.ok) {
      setEditingTripId(null)
      await loadShiftTrips(selectedShiftId)
    } else {
      result.errors.forEach((error) => {
        if (error.field in values) {
          editTripForm.setError(error.field as keyof TripValues, { message: error.message })
        }
      })
    }
  }

  async function handleDeleteTrip(trip: TripRow): Promise<void> {
    if (!confirm(`متأكد إنك عايز تمسح النقلة ${trip.id}؟`)) return
    const result = await window.api.deleteTrip({ id: trip.id })
    if (result.ok) {
      if (selectedShiftId) await loadShiftTrips(selectedShiftId)
    }
  }

  function handlePhotoChange(tripId: string, photoPath: string | null): void {
    setShiftTrips((previous) =>
      previous.map((trip) => (trip.id === tripId ? { ...trip, receiptPhotoPath: photoPath } : trip))
    )
  }

  async function handleCreateShift(values: CreateShiftValues): Promise<boolean> {
    if (!selectedDriverIdForShift) return false
    const result = await window.api.createShift({
      ...values,
      driverId: selectedDriverIdForShift
    })
    if (result.ok) {
      createShiftForm.reset()
      await loadShifts()
      return true
    } else {
      result.errors.forEach((error) => {
        if (error.field in values) {
          createShiftForm.setError(error.field as keyof CreateShiftValues, {
            message: error.message
          })
        }
      })
    }
    return false
  }

  async function handleCloseShift(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const result = await window.api.closeShift({ shiftId: closeShiftId, endDate })
    if (result.ok) {
      setCloseShiftId('')
      setEndDate('')
      await loadShifts()
    }
  }

  const selectedShift = shifts.find((shift) => shift.id === selectedShiftId)
  const isSelectedShiftClosed = selectedShift?.status === 'منتهية'

  const shiftColumns: ColumnDef<ShiftListRow, unknown>[] = [
    {
      accessorKey: 'id',
      header: 'رقم الوردية',
      cell: ({ row }) => (
        <Button type="button" variant="link" onClick={() => void selectShift(row.original.id)}>
          {row.original.id}
        </Button>
      )
    },
    { accessorKey: 'driverName', header: 'السائق' },
    { accessorKey: 'vehicleNo', header: 'رقم السيارة' },
    {
      accessorKey: 'status',
      header: 'الحالة',
      cell: ({ getValue }) => (
        <Badge
          className={
            getValue() === 'مفتوحة'
              ? 'border-transparent bg-green-600 text-white hover:bg-green-600'
              : 'border-transparent bg-gray-500 text-white hover:bg-gray-500'
          }
        >
          {String(getValue())}
        </Badge>
      )
    },
    { accessorKey: 'startDate', header: 'تاريخ البداية' },
    { id: 'endDate', accessorFn: (shift) => shift.endDate ?? '—', header: 'تاريخ النهاية' },
    { accessorKey: 'actualTripCount', header: 'عدد النقلات' }
  ]

  const tripColumns: ColumnDef<TripRow, unknown>[] = [
    { accessorKey: 'id', header: 'id' },
    { accessorKey: 'tripDate', header: 'تاريخ النقلة' },
    { id: 'location', accessorFn: (trip) => trip.location ?? '—', header: 'المكان' },
    { accessorKey: 'crusherCubic', header: 'تكعيب الكسارة' },
    { accessorKey: 'clientCubicReported', header: 'تكعيب العميل' },
    {
      id: 'stonePrice',
      accessorFn: (trip) => trip.stonePrice ?? '—',
      header: 'سعر الحجر'
    },
    { accessorKey: 'transportPrice', header: 'سعر النقل' },
    { accessorKey: 'clientPrice', header: 'سعر العميل' },
    {
      id: 'receiptPhoto',
      header: 'صورة الإيصال',
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) => (
        <TripReceiptPhoto
          tripId={row.original.id}
          photoPath={row.original.receiptPhotoPath}
          onPhotoChange={(photoPath) => handlePhotoChange(row.original.id, photoPath)}
        />
      )
    },
    {
      id: 'actions',
      header: 'إجراءات',
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) =>
        isSelectedShiftClosed ? (
          <span className="text-sm text-muted-foreground">الوردية مقفولة</span>
        ) : (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => startEditingTrip(row.original)}
            >
              تعديل
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleDeleteTrip(row.original)}
            >
              مسح
            </Button>
          </div>
        )
    }
  ]

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">الورديات</h1>

      <Card>
        <CardHeader>
          <CardTitle>سجل الورديات</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">جاري التحميل...</p>
          ) : (
            <DataTable
              columns={shiftColumns}
              data={shifts}
              getRowId={(shift) => shift.id}
              enableRowSelection
              emptyMessage="لا يوجد بيانات بعد"
            />
          )}
        </CardContent>
      </Card>

      {selectedShiftId && (
        <Card>
          <CardHeader>
            <CardTitle>نقلات الوردية {selectedShiftId}</CardTitle>
          </CardHeader>
          <CardContent>
            <Dialog
              open={editingTripId !== null}
              onOpenChange={(open) => {
                if (!open) setEditingTripId(null)
              }}
            >
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
                <DialogHeader>
                  <DialogTitle>تعديل النقلة {editingTripId}</DialogTitle>
                </DialogHeader>
                <TripForm
                  form={editTripForm}
                  resources={resources}
                  locations={resources.locations}
                  crusherReceiptStatus={editCrusherReceiptStatus}
                  recipientNameStatus={editRecipientNameStatus}
                  onSubmit={handleUpdateTrip}
                />
              </DialogContent>
            </Dialog>
            <DataTable
              columns={tripColumns}
              data={shiftTrips}
              getRowId={(trip) => trip.id}
              enableRowSelection
              emptyMessage="لا توجد نقلات في الوردية"
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>فتح وردية جديدة</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Select
            value={selectedDriverIdForShift ? String(selectedDriverIdForShift) : ''}
            onValueChange={(value) => setSelectedDriverIdForShift(Number(value))}
          >
            <SelectTrigger>
              <SelectValue placeholder="اختار السائق" />
            </SelectTrigger>
            <SelectContent>
              {resources.drivers.map((driver) => (
                <SelectItem key={driver.id} value={String(driver.id)}>
                  {driver.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedDriverIdForShift && (
            <CreateShiftForm
              form={createShiftForm}
              vehicles={resources.vehicles}
              onSubmit={handleCreateShift}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>قفل وردية</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCloseShift} className="grid gap-4 md:grid-cols-2">
            <Select value={closeShiftId || ''} onValueChange={setCloseShiftId}>
              <SelectTrigger>
                <SelectValue placeholder="اختار الوردية" />
              </SelectTrigger>
              <SelectContent>
                {shifts
                  .filter((shift) => shift.status === 'مفتوحة')
                  .map((shift) => (
                    <SelectItem key={shift.id} value={shift.id}>
                      {shift.id} ({shift.driverName})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <DatePicker value={endDate} onChange={setEndDate} placeholder="اختر تاريخ القفل" />
            <Button type="submit">قفل الوردية</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
