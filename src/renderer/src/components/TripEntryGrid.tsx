import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Copy, Trash2, Columns3, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { resolveName } from '@/lib/tripGrid'
import type { TripGridColumn, TripGridPayload } from '@/lib/tripGrid'
import type { ResourceState } from '@/pages/tripFormSchema'
import {
  coreColumns,
  createRow,
  extraColumns,
  isPriceColumn
} from './trip-entry-grid/tripEntryGridTypes'
import type {
  GridColumn,
  GridRow,
  TripEntryShift,
  TripGridNames
} from './trip-entry-grid/tripEntryGridTypes'
import { TripEntryGridTable } from './trip-entry-grid/TripEntryGridTable'
import { useTripGridNavigation } from './trip-entry-grid/useTripGridNavigation'
import { useTripGridSave } from './trip-entry-grid/useTripGridSave'
import { useTripGridSuggestions } from './trip-entry-grid/useTripGridSuggestions'
import { useTripGridValidation } from './trip-entry-grid/useTripGridValidation'

export function TripEntryGrid({
  shift,
  resources,
  validateTripPayload,
  onRefresh
}: {
  shift: TripEntryShift
  resources: ResourceState
  validateTripPayload: (payload: TripGridPayload) => { field: string; message: string }[]
  onRefresh: () => Promise<void>
}): React.JSX.Element {
  const { t } = useTranslation()
  const rowDefaults = useMemo(
    () => ({
      shiftId: shift.id,
      clientCubicDefault: shift.clientCubicDefault,
      crusherCubicDefault: shift.crusherCubicDefault
    }),
    [shift.id, shift.clientCubicDefault, shift.crusherCubicDefault]
  )
  const [rows, setRows] = useState<GridRow[]>([])
  const [showExtras, setShowExtras] = useState(false)
  const [selectedRowId, setSelectedRowId] = useState<number>()
  const rowIdRef = useRef(0)
  const inputRefs = useRef(new Map<string, HTMLInputElement>())
  const pendingFocus = useRef<{ rowIndex: number; column: TripGridColumn } | null>(null)
  const names: TripGridNames = {
    clients: resources.clients,
    crushers: resources.crushers,
    materialTypes: resources.materialTypes
  }
  const labelFor = (column: TripGridColumn): string => {
    if (column === 'notes') return t('common.columns.notes')
    const key =
      column === 'recipient'
        ? 'recipientName'
        : column === 'clientReceiptNo'
          ? 'clientReceiptNumber'
          : column === 'crusherReceipt'
            ? 'crusherReceiptNumber'
            : column
    return t(`tripForm.fields.${key}`)
  }
  const columns: GridColumn[] = [...coreColumns, ...(showExtras ? extraColumns : [])].map(
    (column) => ({
      ...column,
      label: labelFor(column.key)
    })
  )

  useEffect(() => {
    const first = createRow(++rowIdRef.current, rowDefaults)
    setRows([first])
    setSelectedRowId(first.rowId)
  }, [rowDefaults])

  useEffect(() => {
    const target = pendingFocus.current
    if (target) {
      pendingFocus.current = null
      const targetRow = rows[target.rowIndex]
      const input = targetRow && inputRefs.current.get(`${targetRow.rowId}:${target.column}`)
      input?.focus()
    }
  }, [rows])

  function addRow(previous?: GridRow): number {
    const row = createRow(++rowIdRef.current, rowDefaults, previous?.tripDate)
    setRows((current) => [...current, row])
    setSelectedRowId(row.rowId)
    return row.rowId
  }

  function updateRow(rowId: number, update: (row: GridRow) => GridRow): void {
    setRows((current) => current.map((row) => (row.rowId === rowId ? update(row) : row)))
  }

  const { refreshPriceSuggestions, clearCache } = useTripGridSuggestions({
    rows,
    updateRow,
    resetKey: rowDefaults
  })
  const { errorsByRow, validCount } = useTripGridValidation(
    rows,
    rowDefaults.shiftId,
    validateTripPayload
  )

  function resolveCellName(rowId: number, column: TripGridColumn, value: string): void {
    const options =
      column === 'client'
        ? names.clients
        : column === 'crusher'
          ? names.crushers
          : names.materialTypes
    const resolved = resolveName(value, options)
    const resolvedId = resolved && 'id' in resolved ? resolved.id : undefined
    const currentRow = rows.find((row) => row.rowId === rowId)
    const updated = currentRow
      ? {
          ...currentRow,
          [column]: value,
          ...(column === 'client' ? { clientId: resolvedId } : {}),
          ...(column === 'crusher' ? { crusherId: resolvedId } : {}),
          ...(column === 'materialType' ? { materialTypeId: resolvedId } : {}),
          serverErrors: { ...currentRow.serverErrors, [column]: undefined }
        }
      : undefined
    updateRow(rowId, (row) => ({
      ...row,
      [column]: value,
      ...(column === 'client' ? { clientId: resolvedId } : {}),
      ...(column === 'crusher' ? { crusherId: resolvedId } : {}),
      ...(column === 'materialType' ? { materialTypeId: resolvedId } : {}),
      serverErrors: { ...row.serverErrors, [column]: undefined }
    }))
    if (updated) void refreshPriceSuggestions(rowId, updated, [column])
  }

  function changeCell(rowId: number, column: TripGridColumn, value: string): void {
    const previous = rows.find((row) => row.rowId === rowId)
    if (!previous) return
    const updated: GridRow = {
      ...previous,
      [column]: value,
      ...(column === 'client' ? { clientId: undefined } : {}),
      ...(column === 'crusher' ? { crusherId: undefined } : {}),
      ...(column === 'materialType' ? { materialTypeId: undefined } : {}),
      serverErrors: { ...previous.serverErrors, [column]: undefined },
      ...(isPriceColumn(column)
        ? {
            priceEdited: { ...previous.priceEdited, [column]: true },
            suggested: { ...previous.suggested, [column]: false },
            suggestionSources: { ...previous.suggestionSources, [column]: undefined }
          }
        : {})
    }
    updateRow(rowId, (row) => ({
      ...row,
      ...updated
    }))
    if (
      column === 'client' ||
      column === 'crusher' ||
      column === 'materialType' ||
      column === 'location'
    )
      void refreshPriceSuggestions(rowId, updated, [column])
  }

  const { handlePaste, handleKeyDown } = useTripGridNavigation({
    rows,
    setRows,
    columns,
    rowDefaults,
    rowIdRef,
    inputRefs,
    pendingFocus,
    names,
    addRow,
    changeCell,
    refreshPriceSuggestions
  })
  const { saving, saveAll } = useTripGridSave({
    rows,
    rowDefaults,
    errorsByRow,
    validateTripPayload,
    setRows,
    updateRow,
    clearSuggestionCache: clearCache,
    onRefresh
  })

  function deleteRow(rowId: number): void {
    setRows((current) => current.filter((row) => row.rowId !== rowId))
    setSelectedRowId(rows.find((row) => row.rowId !== rowId)?.rowId)
  }

  function duplicateSelectedRow(): void {
    const source = rows.find((row) => row.rowId === selectedRowId)
    if (!source) return
    const duplicate = {
      ...source,
      rowId: ++rowIdRef.current,
      priceEdited: { ...source.priceEdited },
      suggested: { ...source.suggested },
      serverErrors: {},
      rowMessage: ''
    }
    setRows((current) => {
      const index = current.findIndex((row) => row.rowId === source.rowId)
      return [...current.slice(0, index + 1), duplicate, ...current.slice(index + 1)]
    })
    setSelectedRowId(duplicate.rowId)
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-2" dir="rtl">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={saving}
          onClick={() => addRow(rows.at(-1))}
        >
          <Plus className="h-4 w-4" /> {t('tripGrid.addRow')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={saving || selectedRowId === undefined}
          onClick={duplicateSelectedRow}
        >
          <Copy className="h-4 w-4" /> {t('tripGrid.duplicateRow')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={saving || selectedRowId === undefined}
          onClick={() => selectedRowId !== undefined && deleteRow(selectedRowId)}
        >
          <Trash2 className="h-4 w-4" /> {t('tripGrid.deleteRow')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={saving}
          onClick={() => setShowExtras((value) => !value)}
        >
          <Columns3 className="h-4 w-4" />
          {showExtras ? t('tripGrid.hideExtra') : t('tripGrid.showExtra')}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={saving || validCount === 0}
          onClick={() => void saveAll()}
        >
          <Save className="h-4 w-4" /> {saving ? t('tripGrid.saving') : t('tripGrid.saveAll')}
        </Button>
      </div>
      <TripEntryGridTable
        rows={rows}
        columns={columns}
        errorsByRow={errorsByRow}
        resources={resources}
        saving={saving}
        setInputRef={(key, element) => {
          if (element) inputRefs.current.set(key, element)
          else inputRefs.current.delete(key)
        }}
        onChange={changeCell}
        onResolveName={resolveCellName}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        onFocusRow={setSelectedRowId}
        onDelete={deleteRow}
      />
    </section>
  )
}
