import { useEffect, useState } from 'react'

type TripDetailsRow = Extract<
  Awaited<ReturnType<typeof window.api.listAllTrips>>,
  { ok: true }
>['data'][number]

export function TripDetailsContent({ trip }: { trip: TripDetailsRow }): React.JSX.Element {
  const [photoDataUri, setPhotoDataUri] = useState<string | null>(null)
  const [photoLoading, setPhotoLoading] = useState(Boolean(trip.receiptPhotoPath))

  useEffect(() => {
    let cancelled = false
    if (!trip.receiptPhotoPath) return
    void window.api.getTripPhoto({ photoPath: trip.receiptPhotoPath }).then((result) => {
      if (cancelled) return
      setPhotoDataUri(result.ok ? result.data.dataUri : null)
      setPhotoLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [trip.receiptPhotoPath])

  const details: [string, string | number | null][] = [
    ['رقم النقلة', trip.id],
    ['الوردية', trip.shiftId],
    ['التاريخ', trip.tripDate],
    ['السائق', trip.driverName],
    ['رقم العربية', trip.vehicleNo],
    ['تكعيب الكسارة', trip.crusherCubic],
    ['تكعيب العميل المُبلّغ', trip.clientCubicReported],
    ['كمية الخصم', trip.discountQty],
    ['سبب الخصم', trip.discountReason],
    ['المكان', trip.location],
    ['الكسارة', trip.crusherName],
    ['العميل', trip.clientName],
    ['سعر الحجر', trip.stonePrice],
    ['سعر النقل', trip.transportPrice],
    ['سعر العميل', trip.clientPrice],
    ['حالة إيصال الكسارة', trip.crusherReceiptStatus],
    ['رقم إيصال الكسارة', trip.crusherReceiptNo],
    ['حالة اسم المستلم', trip.recipientNameStatus],
    ['اسم المستلم', trip.recipientName],
    ['رقم إيصال العميل', trip.clientReceiptNo],
    ['ملاحظات', trip.notes]
  ]

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {details.map(([label, value]) => (
          <div key={label} className="min-w-0 border-b border-border/60 pb-2">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 wrap-break-word text-sm">{value ?? '—'}</dd>
          </div>
        ))}
      </dl>
      <section className="space-y-2">
        <h3 className="text-sm font-medium">صورة الإيصال</h3>
        {photoLoading ? (
          <p className="text-sm text-muted-foreground">جاري تحميل الصورة...</p>
        ) : photoDataUri ? (
          <img
            src={photoDataUri}
            alt={`صورة إيصال النقلة ${trip.id}`}
            className="max-h-80 max-w-full rounded-sm border border-border object-contain"
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            {trip.receiptPhotoPath ? 'الصورة غير متاحة' : 'لا يوجد إيصال مصوّر'}
          </p>
        )}
      </section>
    </div>
  )
}
