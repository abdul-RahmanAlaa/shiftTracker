import { useTranslation } from 'react-i18next'
import { AttachmentManager } from '@/components/AttachmentManager'
import { labelForReceiptStatus, labelForRecipientNameStatus } from '@/lib/enumLabels'

type TripDetailsRow = Extract<
  Awaited<ReturnType<typeof window.api.listAllTrips>>,
  { ok: true }
>['data'][number]

export function TripDetailsContent({ trip }: { trip: TripDetailsRow }): React.JSX.Element {
  const { t } = useTranslation()

  const crusherReceiptStatus = labelForReceiptStatus(t, trip.crusherReceiptStatus)
  const recipientNameStatus = labelForRecipientNameStatus(t, trip.recipientNameStatus)
  const details: [string, string | number | null][] = [
    [t('tripDetails.fields.tripNumber'), trip.id],
    [t('common.columns.shift'), trip.shiftId],
    [t('common.columns.date'), trip.tripDate],
    [t('ledgerEntryForm.fields.driver'), trip.driverName],
    [t('vehiclesSettings.fields.vehicleNo'), trip.vehicleNo],
    [t('tripForm.fields.crusherCubic'), trip.crusherCubic],
    [t('tripDetails.fields.clientCubicReported'), trip.clientCubicReported],
    [t('tripDetails.fields.discountQuantity'), trip.discountQty],
    [t('tripForm.fields.discountReason'), trip.discountReason],
    [t('tripForm.fields.location'), trip.location],
    [t('tripForm.fields.crusher'), trip.crusherName],
    [t('tripForm.fields.client'), trip.clientName],
    [t('tripForm.fields.stonePrice'), trip.stonePrice],
    [t('tripForm.fields.transportPrice'), trip.transportPrice],
    [t('tripForm.fields.clientPrice'), trip.clientPrice],
    [t('tripForm.fields.crusherReceiptStatus'), crusherReceiptStatus],
    [t('tripForm.fields.crusherReceiptNumber'), trip.crusherReceiptNo],
    [t('tripForm.fields.recipientNameStatus'), recipientNameStatus],
    [t('tripForm.fields.recipientName'), trip.recipientName],
    [t('tripForm.fields.clientReceiptNumber'), trip.clientReceiptNo],
    [t('common.columns.notes'), trip.notes]
  ]

  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {details.map(([label, value]) => (
          <div key={label} className="min-w-0 border-b border-border/60 pb-2">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 wrap-break-word text-sm">{value ?? t('common.emDash')}</dd>
          </div>
        ))}
      </dl>
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">{t('tripDetails.attachmentsTitle')}</h3>
        <AttachmentManager entityType="TRIP" entityId={trip.id} />
      </section>
    </div>
  )
}
