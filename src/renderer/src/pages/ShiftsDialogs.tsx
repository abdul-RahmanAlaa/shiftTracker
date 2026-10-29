import { useTranslation } from 'react-i18next'
import type { Dispatch, SetStateAction } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { LockKeyhole, Plus } from 'lucide-react'
import { CreateShiftForm } from '@/components/CreateShiftForm'
import type { CreateShiftValues } from '@/components/CreateShiftForm'
import { AttachmentManager } from '@/components/AttachmentManager'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { SubmitButton } from '@/components/SubmitButton'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import type { ShiftListRow, CloseShiftValues, ReopenShiftValues } from './useShiftsPageData'

type ShiftsDialogsProps = {
  shifts: ShiftListRow[]
  drivers: { id: number; name: string }[]
  vehicles: { vehicleNo: number; trailerNo: number; contractorId: number }[]
  createShiftForm: UseFormReturn<CreateShiftValues>
  closeShiftForm: UseFormReturn<CloseShiftValues>
  reopenShiftForm: UseFormReturn<ReopenShiftValues>
  isOpenDialogOpen: boolean
  setIsOpenDialogOpen: Dispatch<SetStateAction<boolean>>
  isCloseDialogOpen: boolean
  setIsCloseDialogOpen: Dispatch<SetStateAction<boolean>>
  isReopenDialogOpen: boolean
  setIsReopenDialogOpen: Dispatch<SetStateAction<boolean>>
  closeShiftId: string
  endDate: string
  reportedTripCount: number | undefined
  reopenShiftId: string
  reopenReason: string
  reopenShiftRootError: string | null
  setReopenShiftRootError: Dispatch<SetStateAction<string | null>>
  closeShiftErrors: string[]
  tripsMissingAttachments: string[]
  shiftToClose: ShiftListRow | undefined
  hasClosingDocument: boolean
  checkingCloseRequirements: boolean
  refreshCloseRequirements: () => void
  handleCreateShift: (values: CreateShiftValues) => Promise<boolean>
  handleCloseShift: (values: CloseShiftValues) => Promise<void>
  handleReopenShift: (values: ReopenShiftValues) => Promise<void>
}

export function ShiftsDialogs({
  shifts,
  drivers,
  vehicles,
  createShiftForm,
  closeShiftForm,
  reopenShiftForm,
  isOpenDialogOpen,
  setIsOpenDialogOpen,
  isCloseDialogOpen,
  setIsCloseDialogOpen,
  isReopenDialogOpen,
  setIsReopenDialogOpen,
  closeShiftId,
  endDate,
  reportedTripCount,
  reopenShiftId,
  reopenReason,
  reopenShiftRootError,
  setReopenShiftRootError,
  closeShiftErrors,
  tripsMissingAttachments,
  shiftToClose,
  hasClosingDocument,
  checkingCloseRequirements,
  refreshCloseRequirements,
  handleCreateShift,
  handleCloseShift,
  handleReopenShift
}: ShiftsDialogsProps): React.JSX.Element {
  const { t } = useTranslation()

  return (
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
          <form onSubmit={reopenShiftForm.handleSubmit(handleReopenShift)} className="grid gap-4">
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
                  selectedShift
                    ? (selectedShift.reportedTripCount ?? selectedShift.actualTripCount ?? 0)
                    : 0
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
                  closeShiftForm.setValue('reportedTripCount', value === '' ? 0 : Number(value), {
                    shouldDirty: true,
                    shouldValidate: true
                  })
                  closeShiftForm.clearErrors('reportedTripCount')
                }}
              />
              {closeShiftForm.formState.errors.reportedTripCount?.message && (
                <p role="alert" className="text-sm text-destructive">
                  {closeShiftForm.formState.errors.reportedTripCount.message}
                </p>
              )}
            </div>
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
                    refreshCloseRequirements()
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
                <p className="text-sm text-muted-foreground">{t('shifts.closingPhotoRequired')}</p>
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
  )
}
