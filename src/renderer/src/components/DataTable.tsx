import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'

interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[]
  data: T[]
  getRowId?: (row: T) => string
  enableRowSelection?: boolean
  sumColumnId?: string
  initialSorting?: SortingState
  emptyMessage?: string
}

function getColumnId<T>(column: ColumnDef<T, unknown>): string | undefined {
  if ('id' in column && column.id) return column.id
  if ('accessorKey' in column && column.accessorKey) return String(column.accessorKey)
  return undefined
}

function getColumnValue<T>(column: ColumnDef<T, unknown>, row: T, index: number): unknown {
  if ('accessorFn' in column && column.accessorFn) return column.accessorFn(row, index)
  if ('accessorKey' in column && column.accessorKey) {
    return String(column.accessorKey)
      .split('.')
      .reduce<unknown>((value, key) => (value as Record<string, unknown>)?.[key], row)
  }
  return undefined
}

function DataTable<T>({
  columns,
  data,
  getRowId,
  enableRowSelection = false,
  sumColumnId,
  initialSorting = [],
  emptyMessage = 'لا يوجد بيانات بعد'
}: DataTableProps<T>): React.JSX.Element {
  const [sorting, setSorting] = useState<SortingState>(initialSorting)
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [openFilterId, setOpenFilterId] = useState<string | null>(null)

  const includesSome: FilterFn<T> = (row, columnId, filterValue) => {
    const selectedValues = Array.isArray(filterValue) ? filterValue.map(String) : []
    if (selectedValues.length === 0) return true
    return selectedValues.includes(String(row.getValue(columnId) ?? '-'))
  }
  includesSome.autoRemove = (value) => !Array.isArray(value) || value.length === 0

  const distinctValuesByColumnId = useMemo(() => {
    const valuesByColumnId = new Map<string, string[]>()

    columns.forEach((column) => {
      const columnId = getColumnId(column)
      if (!columnId) return

      const values = data.map((row, index) => {
        const value = getColumnValue(column, row, index)
        return value === null || value === undefined || value === '' ? '-' : String(value)
      })
      valuesByColumnId.set(columnId, Array.from(new Set(values)).sort())
    })

    return valuesByColumnId
  }, [columns, data])

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
    filterFns: { includesSome },
    defaultColumn: { filterFn: includesSome },
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

  function toggleColumnFilterValue(columnId: string, value: string): void {
    const column = table.getColumn(columnId)
    if (!column) return
    const selectedValues = (column.getFilterValue() as string[] | undefined) ?? []
    const nextValues = selectedValues.includes(value)
      ? selectedValues.filter((selectedValue) => selectedValue !== value)
      : [...selectedValues, value]
    column.setFilterValue(nextValues.length > 0 ? nextValues : undefined)
  }

  function clearColumnFilter(columnId: string): void {
    table.getColumn(columnId)?.setFilterValue(undefined)
  }

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
                  {header.isPlaceholder ? null : header.column.getCanSort() ||
                    header.column.getCanFilter() ? (
                    <Popover
                      open={openFilterId === header.column.id}
                      onOpenChange={(open) => setOpenFilterId(open ? header.column.id : null)}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-full justify-between gap-2 font-medium"
                        >
                          <span className="truncate">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {header.column.getIsSorted() === 'asc' && ' ↑'}
                            {header.column.getIsSorted() === 'desc' && ' ↓'}
                            {Array.isArray(header.column.getFilterValue()) &&
                              (header.column.getFilterValue() as string[]).length > 0 &&
                              ` (${(header.column.getFilterValue() as string[]).length})`}
                          </span>
                          <ArrowUpDown
                            className={
                              header.column.getIsSorted() || header.column.getFilterValue()
                                ? 'h-3.5 w-3.5 shrink-0 text-primary'
                                : 'h-3.5 w-3.5 shrink-0 text-muted-foreground'
                            }
                          />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-0" align="start">
                        <Command>
                          {header.column.getCanSort() && (
                            <div className="flex gap-1 p-2">
                              <Button
                                type="button"
                                variant={
                                  header.column.getIsSorted() === 'asc' ? 'secondary' : 'ghost'
                                }
                                size="sm"
                                className="flex-1 justify-start"
                                onClick={() => header.column.toggleSorting(false)}
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                                ترتيب تصاعدي
                              </Button>
                              <Button
                                type="button"
                                variant={
                                  header.column.getIsSorted() === 'desc' ? 'secondary' : 'ghost'
                                }
                                size="sm"
                                className="flex-1 justify-start"
                                onClick={() => header.column.toggleSorting(true)}
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                                ترتيب تنازلي
                              </Button>
                            </div>
                          )}
                          {header.column.getCanSort() && header.column.getCanFilter() && (
                            <div className="my-1 border-t" />
                          )}
                          {header.column.getCanFilter() && (
                            <>
                              <CommandInput placeholder="ابحث في القيم..." />
                              <CommandList>
                                <CommandEmpty>لا توجد قيم</CommandEmpty>
                                {distinctValuesByColumnId.get(header.column.id)?.map((value) => {
                                  const selectedValues =
                                    (header.column.getFilterValue() as string[] | undefined) ?? []
                                  return (
                                    <CommandItem
                                      key={value}
                                      value={value}
                                      onSelect={() =>
                                        toggleColumnFilterValue(header.column.id, value)
                                      }
                                    >
                                      <Checkbox
                                        checked={selectedValues.includes(value)}
                                        className="mr-2"
                                        tabIndex={-1}
                                        aria-hidden="true"
                                        onClick={(event) => event.stopPropagation()}
                                      />
                                      {value}
                                    </CommandItem>
                                  )
                                })}
                              </CommandList>
                            </>
                          )}
                          {header.column.getCanFilter() &&
                            Array.isArray(header.column.getFilterValue()) &&
                            (header.column.getFilterValue() as string[]).length > 0 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="m-1 h-8 w-[calc(100%-0.5rem)]"
                                onClick={() => clearColumnFilter(header.column.id)}
                              >
                                مسح الفلتر
                              </Button>
                            )}
                        </Command>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    flexRender(header.column.columnDef.header, header.getContext())
                  )}
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
