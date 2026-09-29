/* eslint-disable react-refresh/only-export-components */
import i18n from 'i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/DataTable'

export type LedgerRow = Extract<
  Awaited<ReturnType<typeof window.api.getDriverHistory>>,
  { ok: true }
>['data'][number]
export type ContractorAccount = Extract<
  Awaited<ReturnType<typeof window.api.getContractorAccount>>,
  { ok: true }
>['data']
export type ClientAccount = Extract<
  Awaited<ReturnType<typeof window.api.getClientAccount>>,
  { ok: true }
>['data']

export function getLedgerColumns({
  onEditEntry,
  onDeleteEntry,
  getIsEntryLocked
}: {
  onEditEntry?: (entry: LedgerRow) => void
  onDeleteEntry?: (entry: LedgerRow) => void
  getIsEntryLocked?: (entry: LedgerRow) => boolean
} = {}): ColumnDef<LedgerRow, unknown>[] {
  const t = i18n.t
  const columns: ColumnDef<LedgerRow, unknown>[] = [
    { accessorKey: 'id', header: t('common.columns.id') },
    { accessorKey: 'entryDate', header: t('common.columns.date') },
    { accessorKey: 'movementType', header: t('common.columns.movementType') },
    { accessorKey: 'amount', header: t('common.columns.amount') },
    {
      id: 'shiftId',
      accessorFn: (entry) => entry.shiftId ?? t('common.emptyCell'),
      header: t('common.columns.shift')
    },
    {
      id: 'notes',
      accessorFn: (entry) => entry.notes ?? t('common.emptyCell'),
      header: t('common.columns.notes')
    }
  ]

  if (onEditEntry || onDeleteEntry) {
    columns.push({
      id: 'actions',
      header: t('common.columns.actions'),
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) => {
        const entry = row.original
        const locked = getIsEntryLocked ? getIsEntryLocked(entry) : false

        return (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={locked}
              title={locked ? t('common.lockedShift') : t('common.edit')}
              onClick={() => onEditEntry?.(entry)}
            >
              {t('common.edit')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={locked}
              title={locked ? t('common.lockedShift') : t('common.delete')}
              onClick={() => onDeleteEntry?.(entry)}
            >
              {t('common.delete')}
            </Button>
          </div>
        )
      }
    })
  }

  return columns
}

export type ClientPaymentRow = ClientAccount['payments'][number]

export function getClientPaymentColumns({
  onEdit,
  onDelete
}: {
  onEdit?: (payment: ClientPaymentRow) => void
  onDelete?: (payment: ClientPaymentRow) => void
} = {}): ColumnDef<ClientPaymentRow, unknown>[] {
  const t = i18n.t
  const columns: ColumnDef<ClientPaymentRow, unknown>[] = [
    { accessorKey: 'id', header: t('common.columns.id') },
    { accessorKey: 'entryDate', header: t('common.columns.date') },
    { accessorKey: 'amount', header: t('common.columns.amount') },
    {
      id: 'notes',
      accessorFn: (payment) => payment.notes ?? t('common.emptyCell'),
      header: t('common.columns.notes')
    }
  ]

  if (onEdit || onDelete) {
    columns.push({
      id: 'actions',
      header: t('common.columns.actions'),
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onEdit?.(row.original)}>
            {t('common.edit')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => onDelete?.(row.original)}
          >
            {t('common.delete')}
          </Button>
        </div>
      )
    })
  }

  return columns
}

export function balanceClassName(balance: number): string {
  if (balance > 0) return 'text-lg font-semibold text-green-600'
  if (balance < 0) return 'text-lg font-semibold text-red-600'
  return 'text-lg font-semibold'
}

export function AccountSummary({
  items
}: {
  items: { label: string; value: number; highlight?: boolean }[]
}): React.JSX.Element {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label}>
          <p className="text-sm text-muted-foreground">{item.label}</p>
          <p className={item.highlight ? balanceClassName(item.value) : 'text-lg font-semibold'}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  )
}

export function LedgerEntriesTable({
  entries,
  onEditEntry,
  onDeleteEntry,
  getIsEntryLocked
}: {
  entries: LedgerRow[]
  onEditEntry?: (entry: LedgerRow) => void
  onDeleteEntry?: (entry: LedgerRow) => void
  getIsEntryLocked?: (entry: LedgerRow) => boolean
}): React.JSX.Element {
  return (
    <DataTable
      columns={getLedgerColumns({ onEditEntry, onDeleteEntry, getIsEntryLocked })}
      data={entries}
      getRowId={(entry) => String(entry.id)}
      enableRowSelection
      sumColumnId="amount"
    />
  )
}

export function AccountCard({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  )
}
