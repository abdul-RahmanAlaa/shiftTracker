import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CreateShiftForm, createShiftSchema } from '@/components/CreateShiftForm'
import type { CreateShiftValues } from '@/components/CreateShiftForm'
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
      stonePrice: trip.stonePrice,
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

  async function handleCreateShift(values: CreateShiftValues): Promise<void> {
    if (!selectedDriverIdForShift) return
    const result = await window.api.createShift({
      ...values,
      driverId: selectedDriverIdForShift
    })
    if (result.ok) {
      createShiftForm.reset()
      await loadShifts()
    } else {
      result.errors.forEach((error) => {
        if (error.field in values) {
          createShiftForm.setError(error.field as keyof CreateShiftValues, {
            message: error.message
          })
        }
      })
    }
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">الورديات</h1>

      <Card>
        <CardHeader>
          <CardTitle>سجل الورديات</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">جاري التحميل...</p>
          ) : shifts.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا يوجد بيانات بعد</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم الوردية</TableHead>
                  <TableHead>السائق</TableHead>
                  <TableHead>رقم السيارة</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>تاريخ البداية</TableHead>
                  <TableHead>تاريخ النهاية</TableHead>
                  <TableHead>عدد النقلات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.map((shift) => (
                  <TableRow key={shift.id} onClick={() => void selectShift(shift.id)}>
                    <TableCell>{shift.id}</TableCell>
                    <TableCell>{shift.driverName}</TableCell>
                    <TableCell>{shift.vehicleNo}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          shift.status === 'مفتوحة'
                            ? 'border-transparent bg-green-600 text-white hover:bg-green-600'
                            : 'border-transparent bg-gray-500 text-white hover:bg-gray-500'
                        }
                      >
                        {shift.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{shift.startDate}</TableCell>
                    <TableCell>{shift.endDate ?? '—'}</TableCell>
                    <TableCell>{shift.actualTripCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedShiftId && (
        <Card>
          <CardHeader>
            <CardTitle>نقلات الوردية {selectedShiftId}</CardTitle>
          </CardHeader>
          <CardContent>
            {editingTripId && (
              <div className="mb-6">
                <TripForm
                  form={editTripForm}
                  resources={resources}
                  locations={resources.locations}
                  crusherReceiptStatus={editCrusherReceiptStatus}
                  recipientNameStatus={editRecipientNameStatus}
                  onSubmit={handleUpdateTrip}
                />
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>id</TableHead>
                  <TableHead>تاريخ النقلة</TableHead>
                  <TableHead>المكان</TableHead>
                  <TableHead>تكعيب الكسارة</TableHead>
                  <TableHead>تكعيب العميل</TableHead>
                  <TableHead>سعر الحجر</TableHead>
                  <TableHead>سعر النقل</TableHead>
                  <TableHead>سعر العميل</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shiftTrips.map((trip) => {
                  const selectedShift = shifts.find((shift) => shift.id === selectedShiftId)
                  const isClosed = selectedShift?.status === 'منتهية'
                  return (
                    <TableRow key={trip.id}>
                      <TableCell>{trip.id}</TableCell>
                      <TableCell>{trip.tripDate}</TableCell>
                      <TableCell>{trip.location ?? '—'}</TableCell>
                      <TableCell>{trip.crusherCubic}</TableCell>
                      <TableCell>{trip.clientCubicReported}</TableCell>
                      <TableCell>{trip.stonePrice}</TableCell>
                      <TableCell>{trip.transportPrice}</TableCell>
                      <TableCell>{trip.clientPrice}</TableCell>
                      <TableCell>
                        {isClosed ? (
                          <span className="text-sm text-muted-foreground">الوردية مقفولة</span>
                        ) : (
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => startEditingTrip(trip)}
                            >
                              تعديل
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void handleDeleteTrip(trip)}
                            >
                              مسح
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>فتح وردية جديدة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
