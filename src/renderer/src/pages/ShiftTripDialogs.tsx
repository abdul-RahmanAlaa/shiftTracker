import { useTranslation } from 'react-i18next'
import type { UseFormReturn } from 'react-hook-form'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { TripForm } from './TripForm'
import type { ResourceState, TripValues } from './tripFormSchema'

type ShiftTripDialogsProps = {
  isAddTripDialogOpen: boolean
  setIsAddTripDialogOpen: (open: boolean) => void
  addTripForm: UseFormReturn<TripValues>
  editTripForm: UseFormReturn<TripValues>
  editingTripId: string | null
  setEditingTripId: (tripId: string | null) => void
  resources: ResourceState
  addCrusherReceiptStatus: TripValues['crusherReceiptStatus']
  addRecipientNameStatus: TripValues['recipientNameStatus']
  editCrusherReceiptStatus: TripValues['crusherReceiptStatus']
  editRecipientNameStatus: TripValues['recipientNameStatus']
  handleCreateTrip: (values: TripValues) => Promise<void>
  handleUpdateTrip: (values: TripValues) => Promise<void>
}

export function ShiftTripDialogs({
  isAddTripDialogOpen,
  setIsAddTripDialogOpen,
  addTripForm,
  editTripForm,
  editingTripId,
  setEditingTripId,
  resources,
  addCrusherReceiptStatus,
  addRecipientNameStatus,
  editCrusherReceiptStatus,
  editRecipientNameStatus,
  handleCreateTrip,
  handleUpdateTrip
}: ShiftTripDialogsProps): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <>
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
    </>
  )
}
