import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { LockKeyhole, Plus } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { CreateShiftForm, createShiftSchema } from '@/components/CreateShiftForm'
import type { CreateShiftValues } from '@/components/CreateShiftForm'
import { DataTable } from '@/components/DataTable'
import { AttachmentManager } from '@/components/AttachmentManager'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DatePicker } from '@/components/ui/date-picker'
import { SubmitButton } from '@/components/SubmitButton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

type ShiftListRow = Extract<
  Awaited<ReturnType<typeof window.api.listShifts>>,
  { ok: true }
>['data'][number]
type AttachmentRow = Extract<
  Awaited<ReturnType<typeof window.api.listEntityAttachments>>,
  { ok: true }
>['data'][number]
type CloseShiftValues = { shiftId: string; endDate: string; reportedTripCount?: number }

export function ShiftsPage(): React.JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [shifts, setShifts] = useState<ShiftListRow[]>([])
  const [drivers, setDrivers] = useState<{ id: number; name: string }[]>([])
  const [vehicles, setVehicles] = useState<
    { vehicleNo: number; trailerNo: number; contractorId: number }[]
  >([])
  const [loading, setLoading] = useState(true)
  const [closingAttachments, setClosingAttachments] = useState<AttachmentRow[]>([])
  const [tripsMissingAttachments, setTripsMissingAttachments] = useState<string[]>([])
  const [loadedCloseRequirementsShiftId, setLoadedCloseRequirementsShiftId] = useState<
    string | null
  >(null)
  const [closeShiftErrors, setCloseShiftErrors] = useState<string[]>([])
  const [reopenShiftRootError, setReopenShiftRootError] = useState<string | null>(null)
  const [attachmentRefreshVersion, setAttachmentRefreshVersion] = useState(0)
  const [isOpenDialogOpen, setIsOpenDialogOpen] = useState(false)
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false)
  const [isReopenDialogOpen, setIsReopenDialogOpen] = useState(false)
  const closeShiftForm = useForm<CloseShiftValues>({
    defaultValues: { shiftId: '', endDate: '' }
  })
  const closeShiftId = useWatch({ control: closeShiftForm.control, name: 'shiftId' })
  const endDate = useWatch({ control: closeShiftForm.control, name: 'endDate' })
  const reportedTripCount = useWatch({ control: closeShiftForm.control, name: 'reportedTripCount' })
  const reopenShiftForm = useForm<{ shiftId: string; reason: string }>({
    defaultValues: { shiftId: '', reason: '' }
  })
  const reopenShiftId = useWatch({ control: reopenShiftForm.control, name: 'shiftId' })
  const reopenReason = useWatch({ control: reopenShiftForm.control, name: 'reason' })
  const createShiftForm = useForm<CreateShiftValues>({
    resolver: zodResolver(createShiftSchema),
    defaultValues: {
      driverId: undefined,
      vehicleNo: undefined,
      crusherCubicDefault: 0,
      clientCubicDefault: 0,
      startDate: '',
      reportedDestination: '',
      reportedTripCount: undefined,
      notes: ''
    }
  })

  useEffect(() => {
    void Promise.all([
      window.api.listShifts(),
      window.api.listDrivers(),
      window.api.listVehicles()
    ]).then(([shiftResult, driversResult, vehiclesResult]) => {
      if (shiftResult.ok) setShifts(shiftResult.data)
      if (driversResult.ok) setDrivers(driversResult.data)
      if (vehiclesResult.ok) setVehicles(vehiclesResult.data)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!closeShiftId) return

    let cancelled = false
    void (async () => {
      const [shiftAttachmentsResult, tripsResult] = await Promise.all([
        window.api.listEntityAttachments({ entityType: 'SHIFT', entityId: closeShiftId }),
        window.api.listTripsByShift({ shiftId: closeShiftId })
      ])

      if (cancelled) return
      setClosingAttachments(
        shiftAttachmentsResult.ok
          ? shiftAttachmentsResult.data.filter((attachment) => attachment.kind === 'CLOSING_SHEET')
          : []
      )

      if (tripsResult.ok) {
        const attachmentResults = await Promise.all(
          tripsResult.data.map((trip) =>
            window.api.listEntityAttachments({ entityType: 'TRIP', entityId: trip.id })
          )
        )

        if (cancelled) return
        setTripsMissingAttachments(
          tripsResult.data
            .filter((_, index) => {
              const result = attachmentResults[index]
              return !result.ok || result.data.length === 0
            })
            .map((trip) => trip.id)
        )
      } else {
        setTripsMissingAttachments([])
      }

      setLoadedCloseRequirementsShiftId(closeShiftId)
    })()

    return () => {
      cancelled = true
    }
  }, [closeShiftId, attachmentRefreshVersion])

  async function loadShifts(): Promise<void> {
    const result = await window.api.listShifts()
    if (result.ok) setShifts(result.data)
  }

  async function handleCreateShift(values: CreateShiftValues): Promise<boolean> {
    const result = await window.api.createShift(values)
    if (!result.ok) {
      result.errors.forEach((error) => {
        if (error.field in values) {
          createShiftForm.setError(error.field as keyof CreateShiftValues, {
            message: error.message
          })
        }
      })
      return false
    }
    createShiftForm.reset()
    setIsOpenDialogOpen(false)
    await loadShifts()
    return true
  }

  async function handleCloseShift(values: CloseShiftValues): Promise<void> {
    setCloseShiftErrors([])
    const result = await window.api.closeShift({
      shiftId: values.shiftId,
      endDate: values.endDate,
      ...(shiftToClose?.status === 'REOPENED'
        ? { reportedTripCount: values.reportedTripCount }
        : {})
    })
    if (!result.ok) {
      const tripCountError = result.errors.find(
        (error) => error.field === 'reportedTripCount' || error.field === 'tripCount'
      )
      if (tripCountError) {
        closeShiftForm.setError('reportedTripCount', { message: tripCountError.message })
      }
      setCloseShiftErrors(
        result.errors
          .filter((error) => error.field !== 'reportedTripCount' && error.field !== 'tripCount')
          .map((error) => error.message)
      )
      return
    }
    setIsCloseDialogOpen(false)
    closeShiftForm.reset()
    setClosingAttachments([])
    setTripsMissingAttachments([])
    setLoadedCloseRequirementsShiftId(null)
    setCloseShiftErrors([])
    await loadShifts()
  }

  async function handleReopenShift(values: { shiftId: string; reason: string }): Promise<void> {
    setReopenShiftRootError(null)
    const result = await window.api.reopenShift(values)
    if (!result.ok) {
      result.errors.forEach((error) => {
        if (error.field === 'shiftId' || error.field === 'reason') {
          reopenShiftForm.setError(error.field, {
            message: error.message
          })
        } else if (error.field === 'root') {
          setReopenShiftRootError(error.message)
        }
      })
      return
    }
    setIsReopenDialogOpen(false)
    reopenShiftForm.reset()
    await loadShifts()
  }

  const shiftToClose = shifts.find((shift) => shift.id === closeShiftId)
  const hasClosingDocument = closingAttachments.length > 0
  const checkingCloseRequirements =
    Boolean(closeShiftId) && loadedCloseRequirementsShiftId !== closeShiftId
  const columns: ColumnDef<ShiftListRow, unknown>[] = [
    { accessorKey: 'id', header: t('shifts.shiftInfo.number') },
    { accessorKey: 'driverName', header: t('ledgerEntryForm.fields.driver') },
    { accessorKey: 'vehicleNo', header: t('vehiclesSettings.fields.vehicleNo') },
    {
      accessorKey: 'status',
      header: t('shifts.columns.status'),
      cell: ({ getValue }) => {
        const status = String(getValue())
        const statusKey = status === 'OPEN' ? 'open' : status === 'REOPENED' ? 'reopened' : 'closed'
        const colorClass =
          status === 'OPEN'
            ? 'border-transparent bg-green-600 text-white hover:bg-green-600'
            : status === 'REOPENED'
              ? 'border-transparent bg-amber-500 text-white hover:bg-amber-500'
              : 'border-transparent bg-gray-500 text-white hover:bg-gray-500'

        return <Badge className={colorClass}>{t(`shiftStatus.${statusKey}`)}</Badge>
      }
    },
    { accessorKey: 'startDate', header: t('shifts.columns.startDate') },
    {
      id: 'endDate',
      accessorFn: (shift) => shift.endDate ?? t('common.emDash'),
      header: t('shifts.columns.endDate')
    },
    { accessorKey: 'actualTripCount', header: t('shifts.columns.tripCount') }
  ]

  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{t('shifts.title')}</h1>
        <div className="flex flex-wrap gap-2">
          <Dialog
            open={isOpenDialogOpen}
            onOpenChange={(open) => {
              setIsOpenDialogOpen(open)
              if (!open) createShiftForm.reset()
            }}
          >
            <Button type="button" onClick={() => setIsOpenDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              {t('createShift.title')}
            </Button>
            <DialogContent
              className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"
              closeDisabled={createShiftForm.formState.isSubmitting}
            >
              <DialogHeader>
                <DialogTitle>{t('createShift.title')}</DialogTitle>
              </DialogHeader>
              <CreateShiftForm
                form={createShiftForm}
                drivers={drivers}
                vehicles={vehicles}
                onSubmit={handleCreateShift}
                inline
              />
            </DialogContent>
          </Dialog>
          <Dialog
            open={isReopenDialogOpen}
            onOpenChange={(open) => {
              setIsReopenDialogOpen(open)
              if (!open) {
                reopenShiftForm.reset()
                setReopenShiftRootError(null)
              }
            }}
          >
            <Button type="button" variant="outline" onClick={() => setIsReopenDialogOpen(true)}>
              <LockKeyhole className="h-4 w-4" />
              {t('shifts.reopenCardTitle')}
            </Button>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{t('shifts.reopenCardTitle')}</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={reopenShiftForm.handleSubmit(handleReopenShift)}
                className="grid gap-4"
              >
                <div className="grid gap-2">
                  <Select
                    value={reopenShiftId}
                    onValueChange={(value) => reopenShiftForm.setValue('shiftId', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('shifts.selectShift')} />
                    </SelectTrigger>
                    <SelectContent>
                      {shifts
                        .filter((shift) => shift.status === 'CLOSED')
                        .map((shift) => (
                          <SelectItem key={shift.id} value={shift.id}>
                            {shift.id} ({shift.driverName})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {reopenShiftForm.formState.errors.shiftId?.message && (
                    <p role="alert" className="text-sm text-destructive">
                      {reopenShiftForm.formState.errors.shiftId.message}
                    </p>
                  )}
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">{t('shifts.reason')}</label>
                  <Textarea
                    value={reopenReason}
                    onChange={(event) => reopenShiftForm.setValue('reason', event.target.value)}
                    placeholder={t('shifts.reopenReasonPlaceholder')}
                  />
                  {reopenShiftForm.formState.errors.reason?.message && (
                    <p role="alert" className="text-sm text-destructive">
                      {reopenShiftForm.formState.errors.reason.message}
                    </p>
                  )}
                </div>
                <SubmitButton
                  isSubmitting={reopenShiftForm.formState.isSubmitting}
                  disabled={!reopenShiftId || !reopenReason?.trim()}
                >
                  {t('shifts.reopenSubmit')}
                </SubmitButton>
                {reopenShiftRootError && (
                  <p role="alert" className="text-sm text-destructive">
                    {reopenShiftRootError}
                  </p>
                )}
              </form>
            </DialogContent>
          </Dialog>
          <Dialog
            open={isCloseDialogOpen}
            onOpenChange={(open) => {
              setIsCloseDialogOpen(open)
              if (!open) closeShiftForm.reset()
            }}
          >
            <Button type="button" variant="outline" onClick={() => setIsCloseDialogOpen(true)}>
              <LockKeyhole className="h-4 w-4" />
              {t('shifts.closeCardTitle')}
            </Button>
            <DialogContent
              className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
              closeDisabled={closeShiftForm.formState.isSubmitting}
            >
              <DialogHeader>
                <DialogTitle>{t('shifts.closeCardTitle')}</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={closeShiftForm.handleSubmit(handleCloseShift)}
                className="grid gap-4 md:grid-cols-2"
              >
                <Select
                  value={closeShiftId}
                  onValueChange={(value) => {
                    const selectedShift = shifts.find((shift) => shift.id === value)
                    closeShiftForm.setValue('shiftId', value)
                    closeShiftForm.clearErrors('reportedTripCount')
                    closeShiftForm.setValue(
                      'reportedTripCount',
                      selectedShift?.status === 'REOPENED'
                        ? (selectedShift.reportedTripCount ?? selectedShift.actualTripCount)
                        : undefined
                    )
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('shifts.selectShift')} />
                  </SelectTrigger>
                  <SelectContent>
                    {shifts
                      .filter((shift) => shift.status === 'OPEN' || shift.status === 'REOPENED')
                      .map((shift) => (
                        <SelectItem key={shift.id} value={shift.id}>
                          {shift.id} ({shift.driverName})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {shiftToClose?.status === 'REOPENED' && (
                  <div className="grid gap-2">
                    <label htmlFor="reported-trip-count" className="text-sm font-medium">
                      {t('shifts.reportedTripCount')}
                    </label>
                    <Input
                      id="reported-trip-count"
                      type="number"
                      step="1"
                      min="0"
                      required
                      value={reportedTripCount ?? ''}
                      aria-invalid={Boolean(closeShiftForm.formState.errors.reportedTripCount)}
                      onChange={(event) => {
                        const value = event.currentTarget.value
                        closeShiftForm.setValue(
                          'reportedTripCount',
                          value === '' ? undefined : Number(value),
                          { shouldDirty: true, shouldValidate: true }
                        )
                        closeShiftForm.clearErrors('reportedTripCount')
                      }}
                    />
                    {closeShiftForm.formState.errors.reportedTripCount?.message && (
                      <p role="alert" className="text-sm text-destructive">
                        {closeShiftForm.formState.errors.reportedTripCount.message}
                      </p>
                    )}
                  </div>
                )}
                <DatePicker
                  value={endDate}
                  onChange={(value) => closeShiftForm.setValue('endDate', value)}
                  placeholder={t('shifts.closeDatePlaceholder')}
                />
                {shiftToClose && (
                  <div className="flex flex-col gap-2 md:col-span-2">
                    <p className="text-sm font-medium">{t('receiptPhoto.labels.closingSheet')}</p>
                    <AttachmentManager
                      entityType="SHIFT"
                      entityId={shiftToClose.id}
                      onAttachmentsChange={() => {
                        setLoadedCloseRequirementsShiftId(null)
                        setAttachmentRefreshVersion((previous) => previous + 1)
                      }}
                    />
                  </div>
                )}
                <div className="flex flex-col gap-2 md:col-span-2">
                  <SubmitButton
                    isSubmitting={closeShiftForm.formState.isSubmitting}
                    disabled={
                      !closeShiftId ||
                      !endDate ||
                      checkingCloseRequirements ||
                      !hasClosingDocument ||
                      tripsMissingAttachments.length > 0
                    }
                    title={
                      !hasClosingDocument
                        ? t('shifts.closingPhotoRequired')
                        : tripsMissingAttachments.length > 0
                          ? t('shifts.tripsMissingAttachments', {
                              tripIds: tripsMissingAttachments.join(', ')
                            })
                          : undefined
                    }
                  >
                    {t('shifts.closeSubmit')}
                  </SubmitButton>
                  {!hasClosingDocument && closeShiftId && (
                    <p className="text-sm text-muted-foreground">
                      {t('shifts.closingPhotoRequired')}
                    </p>
                  )}
                  {tripsMissingAttachments.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {t('shifts.tripsMissingAttachments', {
                        tripIds: tripsMissingAttachments.join(', ')
                      })}
                    </p>
                  )}
                  {closeShiftErrors.length > 0 && (
                    <ul className="list-disc space-y-1 pl-5 text-sm text-destructive">
                      {closeShiftErrors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <Card className="min-h-0 flex-1">
        <CardHeader>
          <CardTitle>{t('shifts.listTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-col">
          <DataTable
            columns={columns}
            data={shifts}
            loading={loading}
            getRowId={(shift) => shift.id}
            enableRowSelection
            onRowClick={(shift) => navigate(`/shifts/${encodeURIComponent(shift.id)}`)}
            emptyMessage={t('dataTable.emptyMessage')}
          />
        </CardContent>
      </Card>
    </div>
  )
}
