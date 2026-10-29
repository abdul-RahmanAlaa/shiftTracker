import { useTranslation } from 'react-i18next'
import type { ClipboardEvent, KeyboardEvent } from 'react'
import type { TripGridColumn } from '@/lib/tripGrid'
import type { ResourceState } from '@/pages/tripFormSchema'
import type { GridColumn, GridRow, TripGridCellErrors } from './tripEntryGridTypes'
import { TripEntryGridRow } from './TripEntryGridRow'

export function TripEntryGridTable({
  rows,
  columns,
  errorsByRow,
  resources,
  saving,
  setInputRef,
  onChange,
  onResolveName,
  onPaste,
  onKeyDown,
  onFocusRow,
  onDelete
}: {
  rows: GridRow[]
  columns: GridColumn[]
  errorsByRow: Map<number, TripGridCellErrors>
  resources: ResourceState
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

  return (
    <>
      <datalist id="trip-grid-clients">
        {resources.clients.map((item) => (
          <option key={item.id} value={item.name} />
        ))}
      </datalist>
      <datalist id="trip-grid-crushers">
        {resources.crushers.map((item) => (
          <option key={item.id} value={item.name} />
        ))}
      </datalist>
      <datalist id="trip-grid-materials">
        {resources.materialTypes.map((item) => (
          <option key={item.id} value={item.name} />
        ))}
      </datalist>
      <div className="min-h-0 flex-1 overflow-auto rounded-md border">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-background">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="whitespace-nowrap border-b px-2 py-2 text-right">
                  {column.key === 'crusherReceipt' ? (
                    <span title={t('tripGrid.receiptTooltip')}>{column.label}</span>
                  ) : (
                    column.label
                  )}
                </th>
              ))}
              <th className="whitespace-nowrap border-b px-2 py-2 text-right">
                {t('tripGrid.status')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <TripEntryGridRow
                key={row.rowId}
                row={row}
                rowIndex={rowIndex}
                columns={columns}
                errors={errorsByRow.get(row.rowId) ?? {}}
                saving={saving}
                setInputRef={setInputRef}
                onChange={onChange}
                onResolveName={onResolveName}
                onPaste={onPaste}
                onKeyDown={onKeyDown}
                onFocusRow={onFocusRow}
                onDelete={onDelete}
              />
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
