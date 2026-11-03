import { Input } from '@/components/ui/input'
import { hasHighCubicWarning, isPriceColumn } from './tripEntryGridTypes'
import type { ClipboardEvent, KeyboardEvent } from 'react'
import type { TripGridColumn } from '@/lib/tripGrid'
import type { GridColumn, GridRow, TripGridCellErrors } from './tripEntryGridTypes'
import { useTranslation } from 'react-i18next'

export function TripEntryGridCell({
  row,
  column,
  errors,
  saving,
  setInputRef,
  onChange,
  onResolveName,
  onPaste,
  onKeyDown,
  rowIndex,
  columnIndex
}: {
  row: GridRow
  column: GridColumn
  errors: TripGridCellErrors
  saving: boolean
  rowIndex: number
  columnIndex: number
  setInputRef: (key: string, element: HTMLElement | null) => void
  onChange: (rowId: number, column: TripGridColumn, value: string) => void
  onResolveName: (rowId: number, column: TripGridColumn, value: string) => void
  onPaste: (event: ClipboardEvent<HTMLInputElement>, rowIndex: number, columnIndex: number) => void
  onKeyDown: (event: KeyboardEvent<HTMLElement>, rowIndex: number, columnIndex: number) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const suggested = isPriceColumn(column.key) && row.suggested[column.key]

  return (
    <td className="border-b px-1 py-1 align-top">
      {column.kind === 'timeOfDay' ? (
        <select
          ref={(element) => setInputRef(`${row.rowId}:${column.key}`, element)}
          value={row.timeOfDay}
          disabled={saving}
          aria-label={column.label}
          className="h-8 w-full min-w-20 rounded-md border border-input bg-background px-2 text-sm"
          onChange={(event) => onChange(row.rowId, column.key, event.target.value)}
          onKeyDown={(event) => onKeyDown(event, rowIndex, columnIndex)}
        >
          <option value="">{t('common.emDash')}</option>
          <option value="MORNING">{t('dashboard.morning')}</option>
          <option value="EVENING">{t('dashboard.evening')}</option>
        </select>
      ) : (
        <Input
          ref={(element) => setInputRef(`${row.rowId}:${column.key}`, element)}
          value={row[column.key]}
          list={column.list}
          disabled={saving}
          inputMode={
            column.kind === 'money' || column.kind === 'number'
              ? 'decimal'
              : column.kind === 'receipt'
                ? 'numeric'
                : undefined
          }
          aria-label={column.label}
          aria-invalid={Boolean(errors[column.key])}
          title={errors[column.key]}
          className={`h-8 min-w-24 ${suggested ? 'bg-amber-50 dark:bg-amber-950' : ''} ${
            hasHighCubicWarning(row, column.key)
              ? 'border-amber-500 bg-amber-50 ring-1 ring-amber-500 dark:bg-amber-950'
              : ''
          }`}
          onChange={(event) => onChange(row.rowId, column.key, event.target.value)}
          onBlur={(event) => {
            if (column.kind === 'name') onResolveName(row.rowId, column.key, event.target.value)
          }}
          onPaste={(event) => onPaste(event, rowIndex, columnIndex)}
          onKeyDown={(event) => onKeyDown(event, rowIndex, columnIndex)}
        />
      )}
      {errors[column.key] && (
        <p className="mt-1 max-w-40 text-xs text-destructive">{errors[column.key]}</p>
      )}
    </td>
  )
}
