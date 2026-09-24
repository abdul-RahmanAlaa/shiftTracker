import { useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  type RowSelectionState,
  type SortingState
} from '@tanstack/react-table'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'

interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[]
  data: T[]
  getRowId?: (row: T) => string
  enableRowSelection?: boolean
  sumColumnId?: string
  emptyMessage?: string
}

function DataTable<T>({
  columns,
  data,
  getRowId,
  enableRowSelection = false,
  sumColumnId,
  emptyMessage = 'لا يوجد بيانات بعد'
}: DataTableProps<T>): React.JSX.Element {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const includesString: FilterFn<T> = (row, columnId, filterValue) =>
    String(row.getValue(columnId) ?? '')
      .toLowerCase()
      .includes(String(filterValue ?? '').toLowerCase())

  // TanStack Table exposes an intentionally mutable table instance.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      ...(enableRowSelection ? { rowSelection } : {})
    },
    getRowId: getRowId ?? ((_row, index) => String(index)),
    enableRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    ...(enableRowSelection ? { onRowSelectionChange: setRowSelection } : {}),
    filterFns: { includesString },
    defaultColumn: { filterFn: 'includesString' },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel()
  })

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>
  }

  const selectedRows = enableRowSelection ? table.getSelectedRowModel().rows : []
  const selectedSum = sumColumnId
    ? selectedRows.reduce((sum, row) => sum + Number(row.getValue(sumColumnId) ?? 0), 0)
    : 0

  return (
    <div>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {enableRowSelection && (
                <TableHead>
                  <Checkbox
                    aria-label="تحديد كل الصفوف"
                    checked={
                      table.getIsAllRowsSelected()
                        ? true
                        : table.getIsSomeRowsSelected()
                          ? 'indeterminate'
                          : false
                    }
                    onCheckedChange={(value) => table.toggleAllRowsSelected(!!value)}
                  />
                </TableHead>
              )}
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder ? null : (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-medium hover:underline"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === 'asc'
                        ? ' ▲'
                        : header.column.getIsSorted() === 'desc'
                          ? ' ▼'
                          : null}
                    </button>
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={`${headerGroup.id}-filters`}>
              {enableRowSelection && <TableHead />}
              {headerGroup.headers.map((header) => (
                <TableHead key={`${header.id}-filter`}>
                  {header.column.getCanFilter() ? (
                    <Input
                      className="h-8 min-w-20 text-xs"
                      value={(header.column.getFilterValue() as string) ?? ''}
                      onChange={(event) => header.column.setFilterValue(event.target.value)}
                      placeholder="فلترة..."
                      aria-label={`فلترة ${String(flexRender(header.column.columnDef.header, header.getContext()))}`}
                    />
                  ) : null}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length + (enableRowSelection ? 1 : 0)}>
                <p className="text-sm text-muted-foreground">{emptyMessage}</p>
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} data-state={row.getIsSelected() ? 'selected' : undefined}>
                {enableRowSelection && (
                  <TableCell>
                    <Checkbox
                      aria-label="تحديد الصف"
                      checked={row.getIsSelected()}
                      onCheckedChange={(value) => row.toggleSelected(!!value)}
                    />
                  </TableCell>
                )}
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {enableRowSelection && sumColumnId && selectedRows.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-4 border-t pt-3 text-sm text-muted-foreground">
          <span>عدد الصفوف المحددة: {selectedRows.length}</span>
          <span>الإجمالي: {selectedSum}</span>
        </div>
      )}
    </div>
  )
}

export { DataTable }
