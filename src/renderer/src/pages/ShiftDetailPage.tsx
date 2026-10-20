import { ipcApi, showSuccessNotice } from '@/lib/ipcErrors'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import type { ColumnDef } from '@tanstack/react-table'
import { Eye, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/DataTable'
import { AttachmentManager } from '@/components/AttachmentManager'
import { ShiftBreadcrumb } from '@/components/ShiftBreadcrumb'
import { TripDetailsContent } from '@/components/TripDetailsContent'
import { useFloatingWindows } from '@/components/FloatingWindowsContext'
import { formatMoney, formatQuantity } from '@/lib/numberFormat'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { TripForm, tripSchema } from './AddTripPage'
import type { ResourceState, TripValues } from './AddTripPage'

type TripRow = Extract<
  Awaited<ReturnType<typeof ipcApi.listTripsByShift>>,
  { ok: true }
>['data'][number]

type ShiftListRow = Extract<
  Awaited<ReturnType<typeof ipcApi.listShifts>>,
  { ok: true }
>['data'][number]

type AllTripsRow = Extract<
  Awaited<ReturnType<typeof ipcApi.listAllTrips>>,
  { ok: true }
>['data'][number]

function isTripFormField(field: string): field is keyof TripValues {
  return Object.hasOwn(tripSchema.shape, field)
}

export function ShiftDetailPage(): React.JSX.Element {
  const { t } = useTranslation()
  const { openWindow } = useFloatingWindows()
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
      fineAmount: 0,
      fineReason: '',
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
      fineAmount: 0,
      fineReason: '',
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
    void Promise.all([ipcApi.listShifts(), ipcApi.listTripsByShift({ shiftId })]).then(
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
    })
  }, [])

  async function loadShiftTrips(): Promise<void> {
    const result = await ipcApi.listTripsByShift({ shiftId })
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
      fineAmount: 0,
      fineReason: '',
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
    addTripForm.clearErrors('root')
    const result = await ipcApi.createTrip({ shiftId, ...values })
    if (!result.ok) {
      const generalErrors: string[] = []
      result.errors.forEach((error) => {
        if (isTripFormField(error.field)) {
          addTripForm.setError(error.field, { message: error.message })
        } else {
          generalErrors.push(error.message)
        }
      })
      if (generalErrors.length > 0) {
        addTripForm.setError('root', {
          type: 'server',
          message: generalErrors.join(' ')
        })
      }
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
      fineAmount: trip.fineAmount,
      fineReason: trip.fineReason ?? '',
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
    const result = await ipcApi.updateTrip({ id: editingTripId, ...values })
    if (result.ok) {
      showSuccessNotice(t('ipcErrors.tripUpdated'))
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
    const result = await ipcApi.deleteTrip({ id: trip.id })
    if (result.ok) {
      showSuccessNotice(t('ipcErrors.tripDeleted'))
      await loadShiftTrips()
    }
  }

  function openTripDetails(trip: TripRow): void {
    const detailsTrip: AllTripsRow = {
      ...trip,
      driverName: shift?.driverName ?? t('common.emptyCell'),
      vehicleNo: shift?.vehicleNo ?? 0,
      crusherName:
        resources.crushers.find((crusher) => crusher.id === trip.crusherId)?.name ??
        t('common.emptyCell'),
      clientName:
        resources.clients.find((client) => client.id === trip.clientId)?.name ??
        t('common.emptyCell'),
      materialTypeName:
        resources.materialTypes.find((materialType) => materialType.id === trip.materialTypeId)
          ?.name ?? null
    }

    openWindow(
      trip.id,
      t('allTrips.detailsTitle', { id: trip.id }),
      <TripDetailsContent trip={detailsTrip} />
    )
  }

  const isShiftClosed = shift?.status === 'CLOSED'
  const loading = loadedShiftId !== shiftId
  const tripColumns: ColumnDef<TripRow, unknown>[] = [
    { accessorKey: 'id', header: t('common.columns.id'), meta: { nowrap: true } },
    {
      accessorKey: 'tripDate',
      header: t('tripForm.fields.tripDate'),
      meta: { nowrap: true }
    },
    {
      accessorKey: 'crusherCubic',
      header: t('tripForm.fields.crusherCubic'),
      meta: { nowrap: true },
      cell: ({ getValue }) => formatQuantity(getValue<number>())
    },
    {
      accessorKey: 'clientCubicReported',
      header: t('tripForm.fields.clientCubic'),
      meta: { nowrap: true },
      cell: ({ getValue }) => formatQuantity(getValue<number>())
    },
    {
      accessorKey: 'clientPrice',
      header: t('tripForm.fields.clientPrice'),
      meta: { nowrap: true },
      cell: ({ getValue }) => formatMoney(getValue<number>())
    },
    {
      id: 'receiptPhoto',
      header: t('tripDetails.attachmentsTitle'),
      meta: { nowrap: true },
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) => <AttachmentManager entityType="TRIP" entityId={row.original.id} />
    },
    {
      id: 'actions',
      header: t('common.columns.actions'),
      meta: { nowrap: true },
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t('common.details')}
            title={t('common.details')}
            onClick={() => openTripDetails(row.original)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          {isShiftClosed ? (
            <span className="text-sm text-muted-foreground">{t('common.lockedShift')}</span>
          ) : (
            <>
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
            </>
          )}
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
                  <p>{formatQuantity(shift.crusherCubicDefault)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('createShift.fields.clientCubic')}
                  </p>
                  <p>{formatQuantity(shift.clientCubicDefault)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('shifts.columns.tripCount')}</p>
                  <p>{formatQuantity(shift.actualTripCount)}</p>
                </div>
              </CardContent>
            </Card>
          )}
          <Card className="flex min-h-0 flex-1 flex-col">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle>{t('shifts.tripsTitle', { id: shift?.id ?? shiftId })}</CardTitle>
              {shift?.status === 'REOPENED' && (
                <Button type="button" variant="outline" onClick={openAddTripDialog}>
                  <Plus className="h-4 w-4" />
                  {t('shifts.addTrip')}
                </Button>
              )}
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col">
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
                  {addTripForm.formState.errors.root?.message && (
                    <div role="alert" className="rounded border border-destructive p-3 text-sm">
                      <p className="font-medium">{t('shifts.addTripError')}</p>
                      <p>{addTripForm.formState.errors.root.message}</p>
                    </div>
                  )}
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
