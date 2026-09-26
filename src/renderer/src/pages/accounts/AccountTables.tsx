/* eslint-disable react-refresh/only-export-components */
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
  const columns: ColumnDef<LedgerRow, unknown>[] = [
    { accessorKey: 'id', header: 'id' },
    { accessorKey: 'entryDate', header: 'التاريخ' },
    { accessorKey: 'movementType', header: 'نوع الحركة' },
    { accessorKey: 'amount', header: 'المبلغ' },
    { id: 'shiftId', accessorFn: (entry) => entry.shiftId ?? '-', header: 'الوردية' },
    { id: 'notes', accessorFn: (entry) => entry.notes ?? '-', header: 'ملاحظات' }
  ]

  if (onEditEntry || onDeleteEntry) {
    columns.push({
      id: 'actions',
      header: 'الإجراءات',
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
              title={locked ? 'مرتبطة بوردية مقفولة' : 'تعديل'}
              onClick={() => onEditEntry?.(entry)}
            >
              تعديل
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={locked}
              title={locked ? 'مرتبطة بوردية مقفولة' : 'مسح'}
              onClick={() => onDeleteEntry?.(entry)}
            >
              مسح
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
  const columns: ColumnDef<ClientPaymentRow, unknown>[] = [
    { accessorKey: 'id', header: 'id' },
    { accessorKey: 'entryDate', header: 'التاريخ' },
    { accessorKey: 'amount', header: 'المبلغ' },
    { id: 'notes', accessorFn: (payment) => payment.notes ?? '-', header: 'ملاحظات' }
  ]

  if (onEdit || onDelete) {
    columns.push({
      id: 'actions',
      header: 'الإجراءات',
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onEdit?.(row.original)}>
            تعديل
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => onDelete?.(row.original)}
          >
            مسح
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
