import { resolveName, parsePaste } from '@/lib/tripGrid'
import type { ClipboardEvent, KeyboardEvent, RefObject } from 'react'
import type { TripGridColumn } from '@/lib/tripGrid'
import { createRow, isPriceColumn } from './tripEntryGridTypes'
import type { GridColumn, GridRow, TripGridDefaults, TripGridNames } from './tripEntryGridTypes'

export function useTripGridNavigation({
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
}: {
  rows: GridRow[]
  setRows: React.Dispatch<React.SetStateAction<GridRow[]>>
  columns: GridColumn[]
  rowDefaults: TripGridDefaults
  rowIdRef: React.MutableRefObject<number>
  inputRefs: RefObject<Map<string, HTMLInputElement>>
  pendingFocus: React.MutableRefObject<{ rowIndex: number; column: TripGridColumn } | null>
  names: TripGridNames
  addRow: (previous?: GridRow) => number
  changeCell: (rowId: number, column: TripGridColumn, value: string) => void
  refreshPriceSuggestions: (
    rowId: number,
    row: GridRow,
    changedKeys: TripGridColumn[],
    sourceRows?: GridRow[]
  ) => Promise<void>
}): {
  handlePaste: (
    event: ClipboardEvent<HTMLInputElement>,
    rowIndex: number,
    columnIndex: number
  ) => void
  handleKeyDown: (
    event: KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    columnIndex: number
  ) => void
} {
  function setPastedValue(row: GridRow, column: TripGridColumn, value: string): GridRow {
    const resolved =
      column === 'client'
        ? resolveName(value, names.clients)
        : column === 'crusher'
          ? resolveName(value, names.crushers)
          : column === 'materialType'
            ? resolveName(value, names.materialTypes)
            : null
    const resolvedId = resolved && 'id' in resolved ? resolved.id : undefined
    return {
      ...row,
      [column]: value,
      ...(column === 'client' ? { clientId: resolvedId } : {}),
      ...(column === 'crusher' ? { crusherId: resolvedId } : {}),
      ...(column === 'materialType' ? { materialTypeId: resolvedId } : {}),
      serverErrors: { ...row.serverErrors, [column]: undefined },
      ...(isPriceColumn(column)
        ? {
            priceEdited: { ...row.priceEdited, [column]: true },
            suggested: { ...row.suggested, [column]: false },
            suggestionSources: { ...row.suggestionSources, [column]: undefined }
          }
        : {})
    }
  }

  function handlePaste(
    event: ClipboardEvent<HTMLInputElement>,
    rowIndex: number,
    columnIndex: number
  ): void {
    const matrix = parsePaste(
      event.clipboardData.getData('text/plain'),
      columns.map((column) => column.label)
    )
    if (matrix.length < 2 && (matrix[0]?.length ?? 0) < 2) return
    event.preventDefault()
    const next = [...rows]
    const changedKeysByRow = new Map<number, TripGridColumn[]>()
    for (let y = 0; y < matrix.length; y += 1) {
      const targetIndex = rowIndex + y
      while (next.length <= targetIndex) {
        next.push(createRow(++rowIdRef.current, rowDefaults, next.at(-1)?.tripDate))
      }
      let target = next[targetIndex]
      const changedKeys: TripGridColumn[] = []
      for (let x = 0; x < matrix[y].length && columnIndex + x < columns.length; x += 1) {
        const column = columns[columnIndex + x]
        target = setPastedValue(target, column.key, matrix[y][x])
        if (
          column.key === 'client' ||
          column.key === 'crusher' ||
          column.key === 'materialType' ||
          column.key === 'location'
        ) {
          changedKeys.push(column.key)
        }
      }
      next[targetIndex] = target
      changedKeysByRow.set(target.rowId, changedKeys)
    }
    setRows(next)
    next.slice(rowIndex, rowIndex + matrix.length).forEach((row) => {
      const changedKeys = changedKeysByRow.get(row.rowId) ?? []
      void refreshPriceSuggestions(row.rowId, row, changedKeys, next)
    })
  }

  function focusCell(rowIndex: number, columnIndex: number): void {
    const targetRow = rows[rowIndex]
    const input =
      targetRow && inputRefs.current.get(`${targetRow.rowId}:${columns[columnIndex]?.key}`)
    input?.focus()
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    columnIndex: number
  ): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
      event.preventDefault()
      const above = rows[rowIndex - 1]
      const current = rows[rowIndex]
      if (above && current)
        changeCell(current.rowId, columns[columnIndex].key, above[columns[columnIndex].key])
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      if (rowIndex === rows.length - 1) {
        addRow(rows[rowIndex])
        pendingFocus.current = { rowIndex: rows.length, column: columns[columnIndex].key }
      } else {
        focusCell(rowIndex + 1, columnIndex)
      }
      return
    }
    if (event.key === 'Tab') {
      let nextRow = rowIndex
      let nextColumn = columnIndex + (event.shiftKey ? -1 : 1)
      if (nextColumn < 0) {
        nextRow -= 1
        nextColumn = columns.length - 1
      } else if (nextColumn >= columns.length) {
        nextRow += 1
        nextColumn = 0
      }
      if (nextRow < 0) return
      event.preventDefault()
      if (nextRow >= rows.length) {
        addRow(rows[rowIndex])
        pendingFocus.current = { rowIndex: rows.length, column: columns[0].key }
      } else if (nextRow >= 0) {
        focusCell(nextRow, nextColumn)
      }
    }
  }

  return { handlePaste, handleKeyDown }
}
