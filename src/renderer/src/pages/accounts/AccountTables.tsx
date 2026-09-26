/* eslint-disable react-refresh/only-export-components */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ColumnDef } from '@tanstack/react-table'
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

const ledgerColumns: ColumnDef<LedgerRow, unknown>[] = [
  { accessorKey: 'id', header: 'id' },
  { accessorKey: 'entryDate', header: 'التاريخ' },
  { accessorKey: 'movementType', header: 'نوع الحركة' },
  { accessorKey: 'amount', header: 'المبلغ' },
  { id: 'shiftId', accessorFn: (entry) => entry.shiftId ?? '-', header: 'الوردية' },
  { id: 'notes', accessorFn: (entry) => entry.notes ?? '-', header: 'ملاحظات' }
]

export type ClientPaymentRow = ClientAccount['payments'][number]

export const clientPaymentColumns: ColumnDef<ClientPaymentRow, unknown>[] = [
  { accessorKey: 'id', header: 'id' },
  { accessorKey: 'entryDate', header: 'التاريخ' },
  { accessorKey: 'amount', header: 'المبلغ' },
  { id: 'notes', accessorFn: (payment) => payment.notes ?? '-', header: 'ملاحظات' }
]

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

export function LedgerEntriesTable({ entries }: { entries: LedgerRow[] }): React.JSX.Element {
  return (
    <DataTable
      columns={ledgerColumns}
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
