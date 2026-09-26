type LedgerEntryDetailsRow = Extract<
  Awaited<ReturnType<typeof window.api.listLedgerEntries>>,
  { ok: true }
>['data'][number]

interface LedgerEntryDetailsContentProps {
  entry: LedgerEntryDetailsRow
  contractorName?: string | null
  driverName?: string | null
}

export function LedgerEntryDetailsContent({
  entry,
  contractorName,
  driverName
}: LedgerEntryDetailsContentProps): React.JSX.Element {
  const details: [string, string | number | null][] = [
    ['رقم الحركة', entry.id],
    ['التاريخ', entry.entryDate],
    ['نوع الحركة', entry.movementType],
    ['المبلغ', entry.amount],
    ['المقاول', contractorName ?? '—'],
    ['السائق', driverName ?? '—'],
    ['الوردية', entry.shiftId ?? '—'],
    ['ملاحظات', entry.notes ?? '—']
  ]

  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {details.map(([label, value]) => (
          <div key={label} className="min-w-0 border-b border-border/60 pb-2">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 wrap-break-word text-sm">{value ?? '—'}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
