import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import type { ColumnDef } from '@tanstack/react-table'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import type { DraftTripListRow, OpenShiftCard } from '../../../preload/index.d'
import { DataTable } from '@/components/DataTable'
import { useConfirm } from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { ipcApi } from '@/lib/ipcErrors'
import { formatMoney, formatQuantity } from '@/lib/numberFormat'
import { TripForm } from './TripForm'
import { tripSchema } from './tripFormSchema'
import type { ResourceState, TripValues } from './tripFormSchema'
import { useDashboardPage } from './useDashboardPage'

interface DraftFormValues {
  vehicleNo: string
  tripDate: string
  timeOfDay: '' | 'MORNING' | 'EVENING'
  crusherId: string
  clientId: string
  cubic: string
  custodyAmount: string
  custodyTime: string
  receiptNote: string
  notes: string
}

const emptyDraftForm: DraftFormValues = {
  vehicleNo: '',
  tripDate: '',
  timeOfDay: '',
  crusherId: '',
  clientId: '',
  cubic: '',
  custodyAmount: '',
  custodyTime: '',
  receiptNote: '',
  notes: ''
}

const emptyTripResources: ResourceState = {
  drivers: [],
  vehicles: [],
  crushers: [],
  clients: [],
  materialTypes: [],
  locations: []
}

function localDateString(): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function draftFormValues(draft: DraftTripListRow): DraftFormValues {
  return {
    vehicleNo: String(draft.vehicle_no),
    tripDate: draft.trip_date,
    timeOfDay: draft.time_of_day ?? '',
    crusherId: draft.crusher_id === null ? '' : String(draft.crusher_id),
    clientId: draft.client_id === null ? '' : String(draft.client_id),
    cubic: draft.cubic === null ? '' : String(draft.cubic),
    custodyAmount: draft.custody_amount === null ? '' : String(draft.custody_amount),
    custodyTime: draft.custody_time ?? '',
    receiptNote: draft.receipt_note ?? '',
    notes: draft.notes ?? ''
  }
}

function optionalNumber(value: string): number | undefined {
  return value === '' ? undefined : Number(value)
}

function nullableNumber(value: string): number | null {
  return value === '' ? null : Number(value)
}

function selectedTimeOfDay(value: string): DraftFormValues['timeOfDay'] {
  return value === 'MORNING' || value === 'EVENING' ? value : ''
}

export function DashboardPage(): React.JSX.Element {
  const { t } = useTranslation()
  const { data, loading, refresh } = useDashboardPage()
  const requestConfirmation = useConfirm()
  const [draftDialogOpen, setDraftDialogOpen] = useState(false)
  const [editingDraftId, setEditingDraftId] = useState<number | null>(null)
  const [draftValues, setDraftValues] = useState<DraftFormValues>(emptyDraftForm)
  const [savingDraft, setSavingDraft] = useState(false)
  const [promotingDraft, setPromotingDraft] = useState<DraftTripListRow | null>(null)
  const [tripResources, setTripResources] = useState<ResourceState>(emptyTripResources)
  const [tripResourcesLoading, setTripResourcesLoading] = useState(true)
  const promoteForm = useForm<TripValues>({
    resolver: zodResolver(tripSchema),
    defaultValues: {
      crusherReceiptStatus: 'UNKNOWN',
      recipientNameStatus: 'UNCLEAR'
    }
  })
  const crusherReceiptStatus = useWatch({
    control: promoteForm.control,
    name: 'crusherReceiptStatus'
  })
  const recipientNameStatus = useWatch({
    control: promoteForm.control,
    name: 'recipientNameStatus'
  })

  useEffect(() => {
    void Promise.all([
      ipcApi.listCrushers(),
      ipcApi.listClients(),
      ipcApi.listMaterialTypes(),
      ipcApi.listTripLocations()
    ])
      .then(([crushers, clients, materialTypes, locations]) => {
        setTripResources({
          ...emptyTripResources,
          crushers: crushers.ok ? crushers.data : [],
          clients: clients.ok ? clients.data : [],
          materialTypes: materialTypes.ok ? materialTypes.data : [],
          locations: locations.ok ? locations.data : []
        })
      })
      .finally(() => setTripResourcesLoading(false))
  }, [])

  const columns: ColumnDef<DraftTripListRow, unknown>[] = [
    { accessorKey: 'trip_date', header: t('dashboard.date'), meta: { nowrap: true } },
    {
      accessorKey: 'time_of_day',
      header: t('dashboard.timeOfDay'),
      meta: { nowrap: true },
      cell: ({ row }) => {
        const timeOfDay = row.original.time_of_day
        return timeOfDay === null
          ? t('common.emDash')
          : t(timeOfDay === 'MORNING' ? 'dashboard.morning' : 'dashboard.evening')
      }
    },
    {
      accessorKey: 'vehicle_no',
      header: t('dashboard.vehicle'),
      meta: { nowrap: true }
    },
    {
      accessorKey: 'driver_name',
      header: t('dashboard.driver'),
      cell: ({ row }) => row.original.driver_name ?? t('common.emDash')
    },
    {
      accessorKey: 'crusher_name',
      header: t('dashboard.crusher'),
      cell: ({ row }) => row.original.crusher_name ?? t('common.emDash')
    },
    {
      accessorKey: 'client_name',
      header: t('dashboard.client'),
      cell: ({ row }) => row.original.client_name ?? t('common.emDash')
    },
    {
      accessorKey: 'cubic',
      header: t('dashboard.cubic'),
      meta: { nowrap: true },
      cell: ({ row }) =>
        row.original.cubic === null ? t('common.emDash') : formatQuantity(row.original.cubic)
    },
    {
      accessorKey: 'custody_amount',
      header: t('dashboard.custody'),
      meta: { nowrap: true },
      cell: ({ row }) =>
        row.original.custody_amount === null
          ? t('common.emDash')
          : formatMoney(row.original.custody_amount)
    },
    {
      accessorKey: 'receipt_note',
      header: t('dashboard.receipt'),
      cell: ({ row }) => row.original.receipt_note ?? t('common.emDash')
    },
    {
      id: 'actions',
      header: t('common.columns.actions'),
      meta: { nowrap: true },
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openDraftEditor(row.original)}
          >
            {t('dashboard.editDraft')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={tripResourcesLoading}
            onClick={() => openPromoteDialog(row.original)}
          >
            {t('dashboard.promote')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleDeleteDraft(row.original.id)}
          >
            {t('dashboard.deleteDraft')}
          </Button>
        </div>
      )
    }
  ]

  function openDraftEditor(draft?: DraftTripListRow): void {
    setEditingDraftId(draft?.id ?? null)
    setDraftValues(
      draft
        ? draftFormValues(draft)
        : {
            ...emptyDraftForm,
            vehicleNo: data.openShifts[0] ? String(data.openShifts[0].vehicle_no) : '',
            tripDate: localDateString()
          }
    )
    setDraftDialogOpen(true)
  }

  function openPromoteDialog(draft: DraftTripListRow): void {
    promoteForm.reset({
      tripDate: draft.trip_date,
      ...(draft.cubic === null
        ? {}
        : { crusherCubic: draft.cubic, clientCubicReported: draft.cubic }),
      ...(draft.crusher_id === null ? {} : { crusherId: draft.crusher_id }),
      ...(draft.client_id === null ? {} : { clientId: draft.client_id }),
      crusherReceiptStatus: 'UNKNOWN',
      recipientNameStatus: 'UNCLEAR'
    })
    setPromotingDraft(draft)
  }

  async function handleDraftSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setSavingDraft(true)
    try {
      if (editingDraftId === null) {
        const vehicleNo = Number(draftValues.vehicleNo)
        const result = await ipcApi.createDraftTrip({
          vehicleNo,
          tripDate: draftValues.tripDate,
          ...(draftValues.timeOfDay ? { timeOfDay: draftValues.timeOfDay } : {}),
          ...(draftValues.crusherId ? { crusherId: Number(draftValues.crusherId) } : {}),
          ...(draftValues.clientId ? { clientId: Number(draftValues.clientId) } : {}),
          ...(optionalNumber(draftValues.cubic) === undefined
            ? {}
            : { cubic: optionalNumber(draftValues.cubic) }),
          ...(optionalNumber(draftValues.custodyAmount) === undefined
            ? {}
            : { custodyAmount: optionalNumber(draftValues.custodyAmount) }),
          ...(draftValues.custodyTime ? { custodyTime: draftValues.custodyTime } : {}),
          ...(draftValues.receiptNote ? { receiptNote: draftValues.receiptNote } : {}),
          ...(draftValues.notes ? { notes: draftValues.notes } : {})
        })
        if (!result.ok) return
      } else {
        const result = await ipcApi.updateDraftTrip({
          id: editingDraftId,
          tripDate: draftValues.tripDate,
          timeOfDay: draftValues.timeOfDay || null,
          crusherId: nullableNumber(draftValues.crusherId),
          clientId: nullableNumber(draftValues.clientId),
          cubic: nullableNumber(draftValues.cubic),
          custodyAmount: nullableNumber(draftValues.custodyAmount),
          custodyTime: draftValues.custodyTime || null,
          receiptNote: draftValues.receiptNote || null,
          notes: draftValues.notes || null
        })
        if (!result.ok) return
      }
      setDraftDialogOpen(false)
      refresh()
    } finally {
      setSavingDraft(false)
    }
  }

  async function handleDeleteDraft(id: number): Promise<void> {
    if (!(await requestConfirmation({ message: t('dashboard.confirmDeleteDraft') }))) return
    const result = await ipcApi.deleteDraftTrip({ id })
    if (result.ok) refresh()
  }

  async function handlePromote(values: TripValues): Promise<void> {
    if (!promotingDraft?.shift_id) return
    const result = await ipcApi.promoteDraftTrip({
      draftId: promotingDraft.id,
      shiftId: promotingDraft.shift_id,
      ...values
    })
    if (result.ok) {
      setPromotingDraft(null)
      refresh()
    }
  }

  function updateDraftField<Field extends keyof DraftFormValues>(
    field: Field,
    value: DraftFormValues[Field]
  ): void {
    setDraftValues((current) => ({ ...current, [field]: value }))
  }

  const availableVehicles = Array.from(
    new Map(data.openShifts.map((shift) => [shift.vehicle_no, shift])).values()
  )

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 overflow-y-auto">
      <h1 className="text-2xl font-semibold">{t('dashboard.title')}</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">{t('dashboard.openShifts')}</h2>
        {loading ? (
          <p className="text-center text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : data.openShifts.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">{t('dashboard.noOpenShifts')}</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.openShifts.map((shift) => (
              <OpenShiftSummaryCard key={shift.shift_id} shift={shift} />
            ))}
          </div>
        )}
      </section>

      <section className="flex min-h-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">{t('dashboard.draftTrips')}</h2>
          <Button
            type="button"
            disabled={availableVehicles.length === 0}
            onClick={() => openDraftEditor()}
          >
            {t('dashboard.addDraft')}
          </Button>
        </div>
        <DataTable
          columns={columns}
          data={data.drafts}
          loading={loading}
          getRowId={(row) => String(row.id)}
          emptyMessage={t('dashboard.noDrafts')}
        />
      </section>

      <Dialog
        open={draftDialogOpen}
        onOpenChange={(open) => {
          setDraftDialogOpen(open)
          if (!open) setEditingDraftId(null)
        }}
      >
        <DialogContent
          className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
          closeDisabled={savingDraft}
        >
          <DialogHeader>
            <DialogTitle>
              {t(editingDraftId === null ? 'dashboard.addDraft' : 'dashboard.editDraft')}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(event) => void handleDraftSubmit(event)}
            className="grid gap-4 sm:grid-cols-2"
          >
            <DraftField label={t('dashboard.vehicleLabel')}>
              {editingDraftId === null ? (
                <Select
                  value={draftValues.vehicleNo}
                  onValueChange={(value) => updateDraftField('vehicleNo', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableVehicles.map((vehicle) => (
                      <SelectItem key={vehicle.vehicle_no} value={String(vehicle.vehicle_no)}>
                        {vehicle.vehicle_no} · {vehicle.driver_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={draftValues.vehicleNo} readOnly />
              )}
            </DraftField>
            <DraftField label={t('dashboard.date')}>
              <Input
                type="date"
                required
                value={draftValues.tripDate}
                onChange={(event) => updateDraftField('tripDate', event.target.value)}
              />
            </DraftField>
            <DraftField label={t('dashboard.timeOfDay')}>
              <Select
                value={draftValues.timeOfDay || 'none'}
                onValueChange={(value) => updateDraftField('timeOfDay', selectedTimeOfDay(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('common.emDash')}</SelectItem>
                  <SelectItem value="MORNING">{t('dashboard.morning')}</SelectItem>
                  <SelectItem value="EVENING">{t('dashboard.evening')}</SelectItem>
                </SelectContent>
              </Select>
            </DraftField>
            <DraftField label={t('dashboard.crusher')}>
              <OptionalEntitySelect
                value={draftValues.crusherId}
                placeholder={t('common.emDash')}
                options={tripResources.crushers}
                onChange={(value) => updateDraftField('crusherId', value)}
              />
            </DraftField>
            <DraftField label={t('dashboard.client')}>
              <OptionalEntitySelect
                value={draftValues.clientId}
                placeholder={t('common.emDash')}
                options={tripResources.clients}
                onChange={(value) => updateDraftField('clientId', value)}
              />
            </DraftField>
            <DraftField label={t('dashboard.cubic')}>
              <Input
                type="number"
                min="0.000001"
                step="any"
                value={draftValues.cubic}
                onChange={(event) => updateDraftField('cubic', event.target.value)}
              />
            </DraftField>
            <DraftField label={t('dashboard.custody')}>
              <Input
                type="number"
                min="1"
                step="1"
                value={draftValues.custodyAmount}
                onChange={(event) => updateDraftField('custodyAmount', event.target.value)}
              />
            </DraftField>
            <DraftField label={t('dashboard.custodyTime')}>
              <Input
                value={draftValues.custodyTime}
                onChange={(event) => updateDraftField('custodyTime', event.target.value)}
              />
            </DraftField>
            <DraftField label={t('dashboard.receipt')}>
              <Input
                value={draftValues.receiptNote}
                onChange={(event) => updateDraftField('receiptNote', event.target.value)}
              />
            </DraftField>
            <DraftField label={t('dashboard.notes')} className="sm:col-span-2">
              <Input
                value={draftValues.notes}
                onChange={(event) => updateDraftField('notes', event.target.value)}
              />
            </DraftField>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setDraftDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={savingDraft}>
                {savingDraft ? t('common.loading') : t('common.confirm')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={promotingDraft !== null}
        onOpenChange={(open) => {
          if (!open) setPromotingDraft(null)
        }}
      >
        <DialogContent
          className="max-h-[90vh] overflow-y-auto sm:max-w-5xl"
          closeDisabled={promoteForm.formState.isSubmitting}
        >
          <DialogHeader>
            <DialogTitle>{t('dashboard.promoteTitle')}</DialogTitle>
          </DialogHeader>
          {promotingDraft && (
            <>
              {promotingDraft.shift_id === null && (
                <p role="alert" className="text-sm text-destructive">
                  {t('dashboard.promoteNoOpenShift')}
                </p>
              )}
              <fieldset
                disabled={promotingDraft.shift_id === null || tripResourcesLoading}
                className="min-w-0 border-0 p-0"
              >
                <TripForm
                  form={promoteForm}
                  resources={tripResources}
                  locations={tripResources.locations}
                  crusherReceiptStatus={crusherReceiptStatus}
                  recipientNameStatus={recipientNameStatus}
                  onSubmit={handlePromote}
                />
              </fieldset>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function OpenShiftSummaryCard({ shift }: { shift: OpenShiftCard }): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-baseline gap-x-2 text-base">
          <span className="text-2xl font-bold">{shift.vehicle_no}</span>
          <span className="text-sm font-normal text-muted-foreground">
            {t('dashboard.trailer')} {shift.trailer_no}
          </span>
          <span className="text-sm font-normal">{shift.driver_name}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        <p>
          <span aria-label={`${shift.days_open} ${t('dashboard.shiftDays')}`}>
            {shift.days_open} {t('dashboard.daysOpen')}
          </span>{' '}
          · {shift.trip_count} {t('dashboard.trips')} · {shift.draft_count} {t('dashboard.drafts')}
        </p>
        <p>
          {shift.last_custody_amount === null
            ? t('dashboard.noCustody')
            : `${t('dashboard.lastCustody')}: ${formatMoney(shift.last_custody_amount)} · ${shift.last_custody_date ?? t('common.emDash')}`}
        </p>
        <p>
          {shift.custody_trips_since} {t('dashboard.custodyTripsSince')}
        </p>
      </CardContent>
    </Card>
  )
}

function DraftField({
  label,
  className,
  children
}: {
  label: string
  className?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <label className={`flex flex-col gap-1.5 text-sm ${className ?? ''}`}>
      <span>{label}</span>
      {children}
    </label>
  )
}

function OptionalEntitySelect({
  value,
  placeholder,
  options,
  onChange
}: {
  value: string
  placeholder: string
  options: { id: number; name: string }[]
  onChange: (value: string) => void
}): React.JSX.Element {
  return (
    <Select value={value || 'none'} onValueChange={(next) => onChange(next === 'none' ? '' : next)}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">{placeholder}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.id} value={String(option.id)}>
            {option.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
