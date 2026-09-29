import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CreateShiftForm, createShiftSchema } from '@/components/CreateShiftForm'
import { ReceiptPhoto } from '@/components/ReceiptPhoto'
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
  closingPhotoPath: string | null
  actualTripCount: number
}

export function ShiftsPage(): React.JSX.Element {
  const { t } = useTranslation()
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
      recipientNameStatus: 'UNCLEAR',
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
    if (!confirm(t('shifts.deleteTripConfirmation', { id: trip.id }))) return
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

  function handleClosingPhotoChange(shiftId: string, photoPath: string | null): void {
    setShifts((previous) =>
      previous.map((shift) =>
        shift.id === shiftId ? { ...shift, closingPhotoPath: photoPath } : shift
      )
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
  const shiftToClose = shifts.find((shift) => shift.id === closeShiftId)
  const hasClosingPhoto = Boolean(shiftToClose?.closingPhotoPath?.trim())

  const shiftColumns: ColumnDef<ShiftListRow, unknown>[] = [
    {
      accessorKey: 'id',
      header: t('shifts.shiftInfo.number'),
      cell: ({ row }) => (
        <Button type="button" variant="link" onClick={() => void selectShift(row.original.id)}>
          {row.original.id}
        </Button>
      )
    },
    { accessorKey: 'driverName', header: t('ledgerEntryForm.fields.driver') },
    { accessorKey: 'vehicleNo', header: t('vehiclesSettings.fields.vehicleNo') },
    {
      accessorKey: 'status',
      header: t('shifts.columns.status'),
      cell: ({ getValue }) => (
        <Badge
          className={
            getValue() === 'مفتوحة'
              ? 'border-transparent bg-green-600 text-white hover:bg-green-600'
              : 'border-transparent bg-gray-500 text-white hover:bg-gray-500'
          }
        >
          {t(getValue() === 'مفتوحة' ? 'shiftStatus.open' : 'shiftStatus.closed')}
        </Badge>
      )
    },
    { accessorKey: 'startDate', header: t('shifts.columns.startDate') },
    {
      id: 'endDate',
      accessorFn: (shift) => shift.endDate ?? t('common.emDash'),
      header: t('shifts.columns.endDate')
    },
    { accessorKey: 'actualTripCount', header: t('shifts.columns.tripCount') }
  ]

  const tripColumns: ColumnDef<TripRow, unknown>[] = [
    { accessorKey: 'id', header: t('common.columns.id') },
    { accessorKey: 'tripDate', header: t('tripForm.fields.tripDate') },
    {
      id: 'location',
      accessorFn: (trip) => trip.location ?? t('common.emDash'),
      header: t('tripForm.fields.location')
    },
    { accessorKey: 'crusherCubic', header: t('tripForm.fields.crusherCubic') },
    { accessorKey: 'clientCubicReported', header: t('tripForm.fields.clientCubic') },
    {
      id: 'stonePrice',
      accessorFn: (trip) => trip.stonePrice ?? t('common.emDash'),
      header: t('tripForm.fields.stonePrice')
    },
    { accessorKey: 'transportPrice', header: t('tripForm.fields.transportPrice') },
    { accessorKey: 'clientPrice', header: t('tripForm.fields.clientPrice') },
    {
      id: 'receiptPhoto',
      header: t('shifts.columns.receiptPhoto'),
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) => (
        <ReceiptPhoto
          entityKind="trip"
          entityId={row.original.id}
          photoPath={row.original.receiptPhotoPath}
          onPhotoChange={(photoPath) => handlePhotoChange(row.original.id, photoPath)}
          savePhoto={(entityId, imageBase64) =>
            window.api.saveTripPhoto({ tripId: entityId, imageBase64 })
          }
          deletePhoto={(entityId) => window.api.deleteTripPhoto({ tripId: entityId })}
          getPhoto={(photoPath) => window.api.getTripPhoto({ photoPath })}
        />
      )
    },
    {
      id: 'actions',
      header: t('common.columns.actions'),
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) =>
        isSelectedShiftClosed ? (
          <span className="text-sm text-muted-foreground">{t('common.lockedShift')}</span>
        ) : (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => startEditingTrip(row.original)}
            >
              {t('common.edit')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleDeleteTrip(row.original)}
            >
              {t('common.delete')}
            </Button>
          </div>
        )
    }
  ]

  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t('shifts.title')}</h1>

      <Card className="min-h-0 flex-1">
        <CardHeader>
          <CardTitle>{t('shifts.listTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-col">
          {loading ? (
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
          ) : (
            <DataTable
              columns={shiftColumns}
              data={shifts}
              getRowId={(shift) => shift.id}
              enableRowSelection
              emptyMessage={t('dataTable.emptyMessage')}
            />
          )}
        </CardContent>
      </Card>

      {selectedShiftId && (
        <Card className="min-h-0 flex-1">
          <CardHeader>
            <CardTitle>{t('shifts.tripsTitle', { id: selectedShiftId })}</CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-col">
            <Dialog
              open={editingTripId !== null}
              onOpenChange={(open) => {
                if (!open) setEditingTripId(null)
              }}
            >
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
                <DialogHeader>
                  <DialogTitle>{t('shifts.editTripTitle', { id: editingTripId })}</DialogTitle>
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
              emptyMessage={t('shifts.emptyTrips')}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('createShift.title')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Select
            value={selectedDriverIdForShift ? String(selectedDriverIdForShift) : ''}
            onValueChange={(value) => setSelectedDriverIdForShift(Number(value))}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('shifts.selectDriver')} />
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
          <CardTitle>{t('shifts.closeCardTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCloseShift} className="grid gap-4 md:grid-cols-2">
            <Select value={closeShiftId || ''} onValueChange={setCloseShiftId}>
              <SelectTrigger>
                <SelectValue placeholder={t('shifts.selectShift')} />
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
            <DatePicker
              value={endDate}
              onChange={setEndDate}
              placeholder={t('shifts.closeDatePlaceholder')}
            />
            {shiftToClose && (
              <div className="flex flex-col gap-2 md:col-span-2">
                <p className="text-sm font-medium">{t('receiptPhoto.labels.shift')}</p>
                <ReceiptPhoto
                  entityKind="shift"
                  entityId={shiftToClose.id}
                  photoPath={shiftToClose.closingPhotoPath}
                  onPhotoChange={(photoPath) =>
                    handleClosingPhotoChange(shiftToClose.id, photoPath)
                  }
                  savePhoto={(entityId, imageBase64) =>
                    window.api.saveShiftPhoto({ shiftId: entityId, imageBase64 })
                  }
                  deletePhoto={(entityId) => window.api.deleteShiftPhoto({ shiftId: entityId })}
                  getPhoto={(photoPath) => window.api.getShiftPhoto({ photoPath })}
                />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Button
                type="submit"
                disabled={!closeShiftId || !endDate || !hasClosingPhoto}
                title={!hasClosingPhoto ? t('shifts.closingPhotoRequired') : undefined}
              >
                {t('shifts.closeSubmit')}
              </Button>
              {!hasClosingPhoto && closeShiftId && (
                <p className="text-sm text-muted-foreground">{t('shifts.closingPhotoRequired')}</p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
