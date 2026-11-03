import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import type { DraftTripListRow, OpenShiftCard } from '../../../preload/index.d'
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
import { formatMoney } from '@/lib/numberFormat'
import { DashboardDraftGrid } from './DashboardDraftGrid'
import { TripForm } from './TripForm'
import { tripSchema } from './tripFormSchema'
import type { ResourceState, TripValues } from './tripFormSchema'
import { useDashboardPage } from './useDashboardPage'

interface DraftDetailsValues {
  tripDate: string
  timeOfDay: '' | 'MORNING' | 'EVENING'
  crusherId: string
  clientId: string
  cubic: string
  custodyAmount: string
  custodyDate: string
  custodyTime: string
  receiptNote: string
  notes: string
}

interface CustodyReviewValues {
  enabled: boolean
  amount: string
  date: string
  time: string
  notes: string
}

const emptyTripResources: ResourceState = {
  drivers: [],
  vehicles: [],
  crushers: [],
  clients: [],
  materialTypes: [],
  locations: []
}

function toDraftDetailsValues(draft: DraftTripListRow): DraftDetailsValues {
  return {
    tripDate: draft.trip_date,
    timeOfDay: draft.time_of_day ?? '',
    crusherId: draft.crusher_id === null ? '' : String(draft.crusher_id),
    clientId: draft.client_id === null ? '' : String(draft.client_id),
    cubic: draft.cubic === null ? '' : String(draft.cubic),
    custodyAmount: draft.custody_amount === null ? '' : String(draft.custody_amount),
    custodyDate: draft.custody_date ?? draft.trip_date,
    custodyTime: draft.custody_time ?? '',
    receiptNote: draft.receipt_note ?? '',
    notes: draft.notes ?? ''
  }
}

function nullableNumber(value: string): number | null {
  if (value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function nullableText(value: string): string | null {
  return value.trim() ? value : null
}

function timeOfDayLabel(
  value: DraftTripListRow['time_of_day'],
  t: (key: 'dashboard.morning' | 'dashboard.evening' | 'common.emDash') => string
): string {
  if (value === 'MORNING') return t('dashboard.morning')
  if (value === 'EVENING') return t('dashboard.evening')
  return t('common.emDash')
}

export function DashboardPage(): React.JSX.Element {
  const { t } = useTranslation()
  const { data, loading, refresh } = useDashboardPage()
  const [detailsDraft, setDetailsDraft] = useState<DraftTripListRow | null>(null)
  const [detailsValues, setDetailsValues] = useState<DraftDetailsValues | null>(null)
  const [detailsError, setDetailsError] = useState<string | null>(null)
  const [savingDetails, setSavingDetails] = useState(false)
  const [promotingDraft, setPromotingDraft] = useState<DraftTripListRow | null>(null)
  const [promotionError, setPromotionError] = useState<string | null>(null)
  const [tripResources, setTripResources] = useState<ResourceState>(emptyTripResources)
  const [tripResourcesLoading, setTripResourcesLoading] = useState(true)
  const [custodyReview, setCustodyReview] = useState<CustodyReviewValues>({
    enabled: false,
    amount: '',
    date: '',
    time: '',
    notes: ''
  })
  const promoteForm = useForm<TripValues>({
    resolver: zodResolver(tripSchema),
    defaultValues: {
      crusherReceiptStatus: 'UNKNOWN',
      recipientNameStatus: 'UNCLEAR',
      timeOfDay: null
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

  function openDraftDetails(draft: DraftTripListRow): void {
    setDetailsDraft(draft)
    setDetailsValues(toDraftDetailsValues(draft))
    setDetailsError(null)
  }

  async function saveDraftDetails(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!detailsDraft || !detailsValues) return
    setSavingDetails(true)
    setDetailsError(null)
    const result = await ipcApi.updateDraftTrip({
      id: detailsDraft.id,
      tripDate: detailsValues.tripDate,
      timeOfDay: detailsValues.timeOfDay || null,
      crusherId: nullableNumber(detailsValues.crusherId),
      clientId: nullableNumber(detailsValues.clientId),
      cubic: nullableNumber(detailsValues.cubic),
      custodyAmount: nullableNumber(detailsValues.custodyAmount),
      custodyDate: nullableText(detailsValues.custodyDate),
      custodyTime: nullableText(detailsValues.custodyTime),
      receiptNote: nullableText(detailsValues.receiptNote),
      notes: nullableText(detailsValues.notes)
    })
    setSavingDetails(false)
    if (!result.ok) {
      setDetailsError(result.errors.map((error) => error.message).join(', '))
      return
    }
    setDetailsDraft(null)
    setDetailsValues(null)
    refresh()
  }

  function openPromoteDialog(draft: DraftTripListRow): void {
    promoteForm.reset({
      tripDate: draft.trip_date,
      timeOfDay: draft.time_of_day,
      ...(draft.cubic === null
        ? {}
        : { crusherCubic: draft.cubic, clientCubicReported: draft.cubic }),
      ...(draft.crusher_id === null ? {} : { crusherId: draft.crusher_id }),
      ...(draft.client_id === null ? {} : { clientId: draft.client_id }),
      notes: draft.notes ?? '',
      crusherReceiptStatus: 'UNKNOWN',
      recipientNameStatus: 'UNCLEAR'
    })
    setCustodyReview({
      enabled: draft.custody_amount !== null,
      amount: draft.custody_amount === null ? '' : String(draft.custody_amount),
      date: draft.custody_date ?? draft.trip_date,
      time: draft.custody_time ?? '',
      notes: ''
    })
    setPromotionError(null)
    setPromotingDraft(draft)
  }

  async function handlePromote(values: TripValues): Promise<void> {
    if (!promotingDraft?.shift_id) return
    setPromotionError(null)
    const custody = custodyReview.enabled
      ? {
          entryDate: custodyReview.date,
          entryTime: custodyReview.time || null,
          amount: Number(custodyReview.amount),
          notes: nullableText(custodyReview.notes)
        }
      : null
    const result = await ipcApi.promoteDraftTrip({
      draftId: promotingDraft.id,
      shiftId: promotingDraft.shift_id,
      ...values,
      custody
    })
    if (!result.ok) {
      setPromotionError(result.errors.map((error) => error.message).join(', '))
      return
    }
    setPromotingDraft(null)
    refresh()
  }

  function setDetailsField<Field extends keyof DraftDetailsValues>(
    field: Field,
    value: DraftDetailsValues[Field]
  ): void {
    setDetailsValues((current) => (current ? { ...current, [field]: value } : current))
  }

  function setCustodyField<Field extends keyof CustodyReviewValues>(
    field: Field,
    value: CustodyReviewValues[Field]
  ): void {
    setCustodyReview((current) => ({ ...current, [field]: value }))
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
        <h2 className="text-xl font-semibold">{t('dashboard.draftTrips')}</h2>
        <DashboardDraftGrid
          drafts={data.drafts}
          vehicles={availableVehicles}
          crushers={tripResources.crushers}
          clients={tripResources.clients}
          loading={loading}
          onRefresh={refresh}
          onDetails={openDraftDetails}
          onPromote={openPromoteDialog}
        />
      </section>

      <Dialog
        open={detailsDraft !== null}
        onOpenChange={(open) => {
          if (!open && !savingDetails) {
            setDetailsDraft(null)
            setDetailsValues(null)
          }
        }}
      >
        <DialogContent
          className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
          closeDisabled={savingDetails}
        >
          <DialogHeader>
            <DialogTitle>{t('dashboard.detailsTitle')}</DialogTitle>
          </DialogHeader>
          {detailsDraft && detailsValues && (
            <form
              onSubmit={(event) => void saveDraftDetails(event)}
              className="grid gap-4 sm:grid-cols-2"
            >
              <label className="grid gap-1.5 text-sm">
                {t('dashboard.vehicle')}
                <Input
                  value={`${detailsDraft.vehicle_no} · ${detailsDraft.driver_name ?? t('common.emDash')}`}
                  readOnly
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                {t('dashboard.date')}
                <Input
                  type="date"
                  required
                  value={detailsValues.tripDate}
                  onChange={(event) => setDetailsField('tripDate', event.target.value)}
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                {t('dashboard.timeOfDay')}
                <Select
                  value={detailsValues.timeOfDay || 'none'}
                  onValueChange={(value) =>
                    setDetailsField(
                      'timeOfDay',
                      value === 'MORNING' || value === 'EVENING' ? value : ''
                    )
                  }
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
              </label>
              <label className="grid gap-1.5 text-sm">
                {t('dashboard.crusher')}
                <Select
                  value={detailsValues.crusherId || 'none'}
                  onValueChange={(value) =>
                    setDetailsField('crusherId', value === 'none' ? '' : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('common.emDash')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('common.emDash')}</SelectItem>
                    {tripResources.crushers.map((crusher) => (
                      <SelectItem key={crusher.id} value={String(crusher.id)}>
                        {crusher.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="grid gap-1.5 text-sm">
                {t('dashboard.client')}
                <Select
                  value={detailsValues.clientId || 'none'}
                  onValueChange={(value) =>
                    setDetailsField('clientId', value === 'none' ? '' : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('common.emDash')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('common.emDash')}</SelectItem>
                    {tripResources.clients.map((client) => (
                      <SelectItem key={client.id} value={String(client.id)}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="grid gap-1.5 text-sm">
                {t('dashboard.cubic')}
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={detailsValues.cubic}
                  onChange={(event) => setDetailsField('cubic', event.target.value)}
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                {t('dashboard.custody')}
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={detailsValues.custodyAmount}
                  onChange={(event) => setDetailsField('custodyAmount', event.target.value)}
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                {t('dashboard.custodyDate')}
                <Input
                  type="date"
                  value={detailsValues.custodyDate}
                  onChange={(event) => setDetailsField('custodyDate', event.target.value)}
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                {t('dashboard.custodyTime')}
                <Input
                  type="time"
                  value={detailsValues.custodyTime}
                  onChange={(event) => setDetailsField('custodyTime', event.target.value)}
                />
              </label>
              <label className="grid gap-1.5 text-sm sm:col-span-2">
                {t('dashboard.receipt')}
                <Input
                  value={detailsValues.receiptNote}
                  onChange={(event) => setDetailsField('receiptNote', event.target.value)}
                />
              </label>
              <label className="grid gap-1.5 text-sm sm:col-span-2">
                {t('dashboard.notes')}
                <Input
                  value={detailsValues.notes}
                  onChange={(event) => setDetailsField('notes', event.target.value)}
                />
              </label>
              {detailsError && (
                <p role="alert" className="text-sm text-destructive sm:col-span-2">
                  {detailsError}
                </p>
              )}
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={savingDetails}
                  onClick={() => setDetailsDraft(null)}
                >
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={savingDetails}>
                  {savingDetails ? t('common.loading') : t('common.confirm')}
                </Button>
              </div>
            </form>
          )}
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
                className="min-w-0 space-y-4 border-0 p-0"
              >
                <section className="rounded-md border p-3">
                  <h3 className="mb-2 text-sm font-semibold">{t('dashboard.draftReference')}</h3>
                  <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                    <ReferenceValue
                      label={t('dashboard.receipt')}
                      value={promotingDraft.receipt_note}
                    />
                    <ReferenceValue
                      label={t('dashboard.custody')}
                      value={
                        promotingDraft.custody_amount === null
                          ? null
                          : formatMoney(promotingDraft.custody_amount)
                      }
                    />
                    <ReferenceValue
                      label={t('dashboard.custodyDate')}
                      value={promotingDraft.custody_date ?? promotingDraft.trip_date}
                    />
                    <ReferenceValue
                      label={t('dashboard.custodyTime')}
                      value={promotingDraft.custody_time}
                    />
                    <ReferenceValue
                      label={t('dashboard.timeOfDay')}
                      value={timeOfDayLabel(promotingDraft.time_of_day, t)}
                    />
                  </dl>
                </section>
                <section className="space-y-3 rounded-md border p-3">
                  <h3 className="text-sm font-semibold">{t('dashboard.custodyReview')}</h3>
                  {promotingDraft.custody_amount !== null ? (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={custodyReview.enabled}
                        onChange={(event) => setCustodyField('enabled', event.target.checked)}
                      />
                      {t('dashboard.promoteCustody')}
                    </label>
                  ) : (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={custodyReview.enabled}
                        onChange={(event) => setCustodyField('enabled', event.target.checked)}
                      />
                      {t('dashboard.addCustody')}
                    </label>
                  )}
                  {custodyReview.enabled && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1.5 text-sm">
                        {t('dashboard.custody')}
                        <Input
                          type="number"
                          min="1"
                          step="0.01"
                          required
                          value={custodyReview.amount}
                          onChange={(event) => setCustodyField('amount', event.target.value)}
                        />
                      </label>
                      <label className="grid gap-1.5 text-sm">
                        {t('dashboard.custodyDate')}
                        <Input
                          type="date"
                          required
                          value={custodyReview.date}
                          onChange={(event) => setCustodyField('date', event.target.value)}
                        />
                      </label>
                      <label className="grid gap-1.5 text-sm">
                        {t('dashboard.custodyTime')}
                        <Input
                          type="time"
                          value={custodyReview.time}
                          onChange={(event) => setCustodyField('time', event.target.value)}
                        />
                      </label>
                      <label className="grid gap-1.5 text-sm">
                        {t('dashboard.custodyNotes')}
                        <Input
                          value={custodyReview.notes}
                          onChange={(event) => setCustodyField('notes', event.target.value)}
                        />
                      </label>
                    </div>
                  )}
                </section>
                {promotionError && (
                  <p role="alert" className="text-sm text-destructive">
                    {promotionError}
                  </p>
                )}
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
            : `${t('dashboard.lastCustody')}: ${formatMoney(shift.last_custody_amount)} · ${shift.last_custody_date ?? t('common.emDash')} ${shift.last_custody_time ?? ''}`}
        </p>
        <p>
          {shift.custody_trips_since} {t('dashboard.custodyTripsSince')}
        </p>
      </CardContent>
    </Card>
  )
}

function ReferenceValue({
  label,
  value
}: {
  label: string
  value: string | null
}): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 wrap-break-word">{value ?? t('common.emDash')}</dd>
    </div>
  )
}
