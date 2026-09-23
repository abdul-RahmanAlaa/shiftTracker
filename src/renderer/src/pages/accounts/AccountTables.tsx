/* eslint-disable react-refresh/only-export-components */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'

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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>id</TableHead>
          <TableHead>التاريخ</TableHead>
          <TableHead>نوع الحركة</TableHead>
          <TableHead>المبلغ</TableHead>
          <TableHead>الوردية</TableHead>
          <TableHead>ملاحظات</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell>{entry.id}</TableCell>
            <TableCell>{entry.entryDate}</TableCell>
            <TableCell>{entry.movementType}</TableCell>
            <TableCell>{entry.amount}</TableCell>
            <TableCell>{entry.shiftId ?? '-'}</TableCell>
            <TableCell>{entry.notes ?? '-'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
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
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}
