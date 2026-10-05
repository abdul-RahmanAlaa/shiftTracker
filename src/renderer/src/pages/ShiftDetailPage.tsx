import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/DataTable'
import { AttachmentManager } from '@/components/AttachmentManager'
import { ShiftBreadcrumb } from '@/components/ShiftBreadcrumb'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { TripForm, tripSchema } from './AddTripPage'
import type { ResourceState, TripValues } from './AddTripPage'

type TripRow = Extract<
  Awaited<ReturnType<typeof window.api.listTripsByShift>>,
  { ok: true }
>['data'][number]

type ShiftListRow = Extract<
  Awaited<ReturnType<typeof window.api.listShifts>>,
  { ok: true }
>['data'][number]

function isTripFormField(field: string): field is keyof TripValues {
  return Object.hasOwn(tripSchema.shape, field)
}

export function ShiftDetailPage(): React.JSX.Element {
  const { t } = useTranslation()
  const { shiftId = '' } = useParams()
  const [shift, setShift] = useState<ShiftListRow | null>(null)
  const [trips, setTrips] = useState<TripRow[]>([])
  const [loadedShiftId, setLoadedShiftId] = useState('')
  const [editingTripId, setEditingTripId] = useState<string | null>(null)
  const [isAddTripDialogOpen, setIsAddTripDialogOpen] = useState(false)
  const [resources, setResources] = useState<ResourceState>({
    drivers: [],
    vehicles: [],
    crushers: [],
    clients: [],
    materialTypes: [],
    locations: []
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
      materialTypeId: undefined,
      stonePrice: undefined,
      crusherReceiptStatus: 'UNKNOWN',
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
  const addTripForm = useForm<TripValues>({
    resolver: zodResolver(tripSchema),
    defaultValues: {
      tripDate: '',
      crusherCubic: 0,
      clientCubicReported: 0,
      discountQty: 0,
      discountReason: '',
      location: '',
      crusherId: undefined,
      materialTypeId: undefined,
      stonePrice: undefined,
      crusherReceiptStatus: 'UNKNOWN',
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
  const addCrusherReceiptStatus = useWatch({
    control: addTripForm.control,
    name: 'crusherReceiptStatus'
  })
  const addRecipientNameStatus = useWatch({
    control: addTripForm.control,
    name: 'recipientNameStatus'
  })

  useEffect(() => {
    let cancelled = false
    void Promise.all([window.api.listShifts(), window.api.listTripsByShift({ shiftId })]).then(
      ([shiftResult, tripResult]) => {
        if (cancelled) return
        setShift(
          shiftResult.ok ? (shiftResult.data.find((item) => item.id === shiftId) ?? null) : null
        )
        setTrips(tripResult.ok ? tripResult.data : [])
        setLoadedShiftId(shiftId)
      }
    )
    return () => {
      cancelled = true
    }
  }, [shiftId])

  useEffect(() => {
    void Promise.all([
      window.api.listDrivers(),
      window.api.listVehicles(),
      window.api.listCrushers(),
      window.api.listClients(),
      window.api.listMaterialTypes(),
      window.api.listTripLocations()
    ]).then(([drivers, vehicles, crushers, clients, materialTypes, locations]) => {
      setResources({
        drivers: drivers.ok ? drivers.data : [],
        vehicles: vehicles.ok ? vehicles.data : [],
        crushers: crushers.ok ? crushers.data : [],
        clients: clients.ok ? clients.data : [],
        materialTypes: materialTypes.ok ? materialTypes.data : [],
        locations: locations.ok ? locations.data : []
      })
    })
  }, [])

  async function loadShiftTrips(): Promise<void> {
    const result = await window.api.listTripsByShift({ shiftId })
    if (result.ok) {
      setTrips(result.data)
      setShift((current) =>
        current ? { ...current, actualTripCount: result.data.length } : current
      )
    } else {
      setTrips([])
    }
  }

  function openAddTripDialog(): void {
    addTripForm.reset({
      tripDate: '',
      crusherCubic: shift?.crusherCubicDefault ?? 0,
      clientCubicReported: shift?.clientCubicDefault ?? 0,
      discountQty: 0,
      discountReason: '',
      location: '',
      crusherId: undefined,
      materialTypeId: undefined,
      stonePrice: undefined,
      crusherReceiptStatus: 'UNKNOWN',
      crusherReceiptNo: undefined,
      clientId: undefined,
      transportPrice: undefined,
      clientPrice: undefined,
      recipientNameStatus: 'UNCLEAR',
      recipientName: '',
      clientReceiptNo: '',
      notes: ''
    })
    setIsAddTripDialogOpen(true)
  }

  async function handleCreateTrip(values: TripValues): Promise<void> {
    const result = await window.api.createTrip({ shiftId, ...values })
    if (!result.ok) {
      result.errors.forEach((error) => {
        if (isTripFormField(error.field)) {
          addTripForm.setError(error.field, { message: error.message })
        }
      })
      return
    }

    setIsAddTripDialogOpen(false)
    addTripForm.reset()
    await loadShiftTrips()
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
      materialTypeId: trip.materialTypeId ?? undefined,
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
    if (!editingTripId) return
    const result = await window.api.updateTrip({ id: editingTripId, ...values })
    if (result.ok) {
      setEditingTripId(null)
      await loadShiftTrips()
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
    if (result.ok) await loadShiftTrips()
  }

  const isShiftClosed = shift?.status === 'CLOSED'
  const loading = loadedShiftId !== shiftId
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
      header: t('tripDetails.attachmentsTitle'),
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) => <AttachmentManager entityType="TRIP" entityId={row.original.id} />
    },
    {
      id: 'actions',
      header: t('common.columns.actions'),
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) =>
        isShiftClosed ? (
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
      <ShiftBreadcrumb currentPage={shiftId} />
      <h1 className="text-2xl font-semibold">{shiftId}</h1>
      {!loading && !shift ? (
        <p className="text-sm text-muted-foreground">{t('shifts.shiftNotFound')}</p>
      ) : (
        <>
          {shift && (
            <Card>
              <CardHeader>
                <CardTitle>{t('shifts.shiftInfo.number')}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('ledgerEntryForm.fields.driver')}
                  </p>
                  <p>{shift.driverName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('vehiclesSettings.fields.vehicleNo')}
                  </p>
                  <p>{shift.vehicleNo}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('shifts.columns.status')}</p>
                  <Badge>
                    {t(
                      shift.status === 'OPEN'
                        ? 'shiftStatus.open'
                        : shift.status === 'REOPENED'
                          ? 'shiftStatus.reopened'
                          : 'shiftStatus.closed'
                    )}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('createShift.fields.startDate')}
                  </p>
                  <p>{shift.startDate}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('shifts.columns.endDate')}</p>
                  <p>{shift.endDate ?? t('common.emDash')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('createShift.fields.crusherCubic')}
                  </p>
                  <p>{shift.crusherCubicDefault}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('createShift.fields.clientCubic')}
                  </p>
                  <p>{shift.clientCubicDefault}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('shifts.columns.tripCount')}</p>
                  <p>{shift.actualTripCount}</p>
                </div>
              </CardContent>
            </Card>
          )}
          <Card className="min-h-0 flex-1">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle>{t('shifts.tripsTitle', { id: shift?.id ?? shiftId })}</CardTitle>
              {shift?.status === 'REOPENED' && (
                <Button type="button" variant="outline" onClick={openAddTripDialog}>
                  <Plus className="h-4 w-4" />
                  {t('shifts.addTrip')}
                </Button>
              )}
            </CardHeader>
            <CardContent className="flex min-h-0 flex-col">
              <Dialog
                open={isAddTripDialogOpen}
                onOpenChange={(open) => {
                  setIsAddTripDialogOpen(open)
                  if (!open) addTripForm.reset()
                }}
              >
                <DialogContent
                  className="max-h-[90vh] overflow-y-auto sm:max-w-4xl"
                  closeDisabled={addTripForm.formState.isSubmitting}
                >
                  <DialogHeader>
                    <DialogTitle>{t('shifts.addTrip')}</DialogTitle>
                  </DialogHeader>
                  <TripForm
                    form={addTripForm}
                    resources={resources}
                    locations={resources.locations}
                    crusherReceiptStatus={addCrusherReceiptStatus}
                    recipientNameStatus={addRecipientNameStatus}
                    onSubmit={handleCreateTrip}
                  />
                </DialogContent>
              </Dialog>
              <Dialog
                open={editingTripId !== null}
                onOpenChange={(open) => {
                  if (!open) setEditingTripId(null)
                }}
              >
                <DialogContent
                  className="max-h-[90vh] overflow-y-auto sm:max-w-4xl"
                  closeDisabled={editTripForm.formState.isSubmitting}
                >
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
                data={trips}
                loading={loading}
                getRowId={(trip) => trip.id}
                enableRowSelection
                emptyMessage={t('shifts.emptyTrips')}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
