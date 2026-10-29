import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm, useWatch } from 'react-hook-form'
import type { Dispatch, SetStateAction } from 'react'
import type { DefaultValues } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useConfirm } from '@/components/ConfirmDialog'
import { ipcApi, showSuccessNotice } from '@/lib/ipcErrors'
import { tripSchema } from './tripFormSchema'
import type { ResourceState, TripValues } from './tripFormSchema'

export type TripRow = Extract<
  Awaited<ReturnType<typeof ipcApi.listTripsByShift>>,
  { ok: true }
>['data'][number]
export type ShiftListRow = Extract<
  Awaited<ReturnType<typeof ipcApi.listShifts>>,
  { ok: true }
>['data'][number]
export type AllTripsRow = Extract<
  Awaited<ReturnType<typeof ipcApi.listAllTrips>>,
  { ok: true }
>['data'][number]

function isTripFormField(field: string): field is keyof TripValues {
  return Object.hasOwn(tripSchema.shape, field)
}

const emptyTripValues = {
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
} satisfies DefaultValues<TripValues>

export type ShiftDetailPageState = {
  shift: ShiftListRow | null
  trips: TripRow[]
  loadedShiftId: string
  resources: ResourceState
  editTripForm: ReturnType<typeof useForm<TripValues>>
  addTripForm: ReturnType<typeof useForm<TripValues>>
  editingTripId: string | null
  setEditingTripId: Dispatch<SetStateAction<string | null>>
  isAddTripDialogOpen: boolean
  setIsAddTripDialogOpen: Dispatch<SetStateAction<boolean>>
  editCrusherReceiptStatus: TripValues['crusherReceiptStatus']
  editRecipientNameStatus: TripValues['recipientNameStatus']
  addCrusherReceiptStatus: TripValues['crusherReceiptStatus']
  addRecipientNameStatus: TripValues['recipientNameStatus']
  loadShiftTrips: () => Promise<void>
  openAddTripDialog: () => void
  handleCreateTrip: (values: TripValues) => Promise<void>
  startEditingTrip: (trip: TripRow) => void
  handleUpdateTrip: (values: TripValues) => Promise<void>
  handleDeleteTrip: (trip: TripRow) => Promise<void>
}

export function useShiftDetailPage(shiftId: string): ShiftDetailPageState {
  const requestConfirmation = useConfirm()
  const { t } = useTranslation()
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
    defaultValues: emptyTripValues
  })
  const addTripForm = useForm<TripValues>({
    resolver: zodResolver(tripSchema),
    defaultValues: emptyTripValues
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
      ...emptyTripValues,
      crusherCubic: shift?.crusherCubicDefault ?? 0,
      clientCubicReported: shift?.clientCubicDefault ?? 0
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
    if (
      !(await requestConfirmation({
        message: t('shifts.deleteTripConfirmation', { id: trip.id })
      }))
    )
      return
    const result = await ipcApi.deleteTrip({ id: trip.id })
    if (result.ok) {
      showSuccessNotice(t('ipcErrors.tripDeleted'))
      await loadShiftTrips()
    }
  }

  return {
    shift,
    trips,
    loadedShiftId,
    resources,
    editTripForm,
    addTripForm,
    editingTripId,
    setEditingTripId,
    isAddTripDialogOpen,
    setIsAddTripDialogOpen,
    editCrusherReceiptStatus,
    editRecipientNameStatus,
    addCrusherReceiptStatus,
    addRecipientNameStatus,
    loadShiftTrips,
    openAddTripDialog,
    handleCreateTrip,
    startEditingTrip,
    handleUpdateTrip,
    handleDeleteTrip
  }
}
