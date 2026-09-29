import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()
  const movementType =
    entry.movementType === 'عهدة'
      ? t('ledgerEntryForm.movementTypes.custody')
      : entry.movementType === 'دفعة'
        ? t('ledgerEntryForm.movementTypes.payment')
        : t('ledgerEntryForm.movementTypes.other')
  const details: [string, string | number | null][] = [
    [t('ledgerEntryDetails.movementNumber'), entry.id],
    [t('ledgerEntryDetails.date'), entry.entryDate],
    [t('ledgerEntryDetails.movementType'), movementType],
    [t('ledgerEntryDetails.amount'), entry.amount],
    [t('ledgerEntryDetails.contractor'), contractorName ?? t('common.emDash')],
    [t('ledgerEntryDetails.driver'), driverName ?? t('common.emDash')],
    [t('ledgerEntryDetails.shift'), entry.shiftId ?? t('common.emDash')],
    [t('ledgerEntryDetails.notes'), entry.notes ?? t('common.emDash')]
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
    </div>
  )
}
