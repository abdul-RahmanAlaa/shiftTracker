import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ClipboardEvent, KeyboardEvent } from 'react'
import type { TripGridColumn } from '@/lib/tripGrid'
import { isEmpty } from './tripEntryGridTypes'
import type { GridColumn, GridRow, TripGridCellErrors } from './tripEntryGridTypes'
import { TripEntryGridCell } from './TripEntryGridCell'

export function TripEntryGridRow({
  row,
  rowIndex,
  columns,
  errors,
  saving,
  setInputRef,
  onChange,
  onResolveName,
  onPaste,
  onKeyDown,
  onFocusRow,
  onDelete
}: {
  row: GridRow
  rowIndex: number
  columns: GridColumn[]
  errors: TripGridCellErrors
  saving: boolean
  setInputRef: (key: string, element: HTMLInputElement | null) => void
  onChange: (rowId: number, column: TripGridColumn, value: string) => void
  onResolveName: (rowId: number, column: TripGridColumn, value: string) => void
  onPaste: (event: ClipboardEvent<HTMLInputElement>, rowIndex: number, columnIndex: number) => void
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>, rowIndex: number, columnIndex: number) => void
  onFocusRow: (rowId: number) => void
  onDelete: (rowId: number) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const rowStatus = isEmpty(row) ? 'empty' : Object.keys(errors).length ? 'error' : 'ready'

  return (
    <Fragment>
      <tr onFocus={() => onFocusRow(row.rowId)}>
        {columns.map((column, columnIndex) => (
          <TripEntryGridCell
            key={column.key}
            row={row}
            column={column}
            errors={errors}
            saving={saving}
            rowIndex={rowIndex}
            columnIndex={columnIndex}
            setInputRef={setInputRef}
            onChange={onChange}
            onResolveName={onResolveName}
            onPaste={onPaste}
            onKeyDown={onKeyDown}
          />
        ))}
        <td className="whitespace-nowrap border-b px-2 py-1 align-top">
          <span className="me-2">{t(`tripGrid.rowStatus.${rowStatus}`)}</span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={saving}
            aria-label={t('tripGrid.deleteRow')}
            onClick={() => onDelete(row.rowId)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </td>
      </tr>
      {(row.rowMessage || Object.keys(errors).length > 0) && (
        <tr>
          <td colSpan={columns.length + 1} className="border-b px-2 py-1 text-xs text-destructive">
            {row.rowMessage ||
              t('tripGrid.rowErrors', {
                errors: [...new Set(Object.values(errors))].join(', ')
              })}
          </td>
        </tr>
      )}
    </Fragment>
  )
}
