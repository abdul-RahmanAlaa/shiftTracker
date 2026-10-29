import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  buildTripPayload,
  mapServerErrors,
  parseDateCell,
  parseNumberCell,
  parseReceiptCell
} from '@/lib/tripGrid'
import type { TripGridColumn, TripGridPayload } from '@/lib/tripGrid'
import { coreColumns, extraColumns, isEmpty } from './tripEntryGridTypes'
import type { GridRow } from './tripEntryGridTypes'

type ValidationResult = {
  errorsByRow: Map<number, Partial<Record<TripGridColumn, string>>>
  validCount: number
}

export function useTripGridValidation(
  rows: GridRow[],
  shiftId: string,
  validateTripPayload: (payload: TripGridPayload) => { field: string; message: string }[]
): ValidationResult {
  const { t } = useTranslation()

  const errorsByRow = useMemo(() => {
    function cellError(row: GridRow, column: TripGridColumn): string | undefined {
      const serverError = row.serverErrors[column]
      if (serverError) return serverError
      if (column === 'tripDate') {
        const result = parseDateCell(row.tripDate)
        return result.ok ? undefined : t(`tripGrid.validation.${result.message}`)
      }
      if (
        column === 'clientCubic' ||
        column === 'crusherCubic' ||
        column === 'stonePrice' ||
        column === 'transportPrice' ||
        column === 'clientPrice' ||
        column === 'fineAmount'
      ) {
        const parsed = parseNumberCell(row[column], {
          money:
            column === 'stonePrice' ||
            column === 'transportPrice' ||
            column === 'clientPrice' ||
            column === 'fineAmount',
          allowGrouping: column !== 'clientCubic' && column !== 'crusherCubic'
        })
        return parsed.ok ? undefined : t(`tripGrid.validation.${parsed.message}`)
      }
      if (column === 'crusherReceipt') {
        const parsed = parseReceiptCell(row.crusherReceipt)
        return parsed.ok ? undefined : t('tripGrid.validation.invalid')
      }
      if (column === 'client')
        return row.clientId ? undefined : row.client ? t('tripGrid.validation.name') : undefined
      if (column === 'crusher')
        return row.crusherId ? undefined : row.crusher ? t('tripGrid.validation.name') : undefined
      if (column === 'materialType') {
        return row.materialTypeId
          ? undefined
          : row.materialType
            ? t('tripGrid.validation.name')
            : undefined
      }
      return undefined
    }

    function rowErrors(row: GridRow): Partial<Record<TripGridColumn, string>> {
      const errors: Partial<Record<TripGridColumn, string>> = {}
      for (const column of [...coreColumns, ...extraColumns]) {
        const error = cellError(row, column.key)
        if (error) errors[column.key] = error
      }
      const built = buildTripPayload(row, shiftId)
      if (!isEmpty(row)) {
        for (const column of [...coreColumns, ...extraColumns]) {
          const message = built.errors[column.key]
          if (message) errors[column.key] ??= t(`tripGrid.validation.${message}`)
        }
      }
      if (built.payload && !isEmpty(row)) {
        const issues = validateTripPayload(built.payload)
        if (issues.length > 0) {
          const mapped = mapServerErrors(issues)
          for (const column of [...coreColumns, ...extraColumns]) {
            const message = mapped.cells[column.key]
            if (message) errors[column.key] ??= message
          }
        }
      }
      return errors
    }

    const errors = new Map(rows.map((row) => [row.rowId, rowErrors(row)]))
    const seen = new Map<string, number>()
    for (const row of rows) {
      const receipt = parseReceiptCell(row.crusherReceipt)
      if (
        !row.clientId ||
        !row.crusherId ||
        !receipt.ok ||
        receipt.value.crusherReceiptStatus !== 'PROVIDED'
      )
        continue
      const key = `${row.crusherId}:${receipt.value.crusherReceiptNo}`
      const first = seen.get(key)
      if (first === undefined) {
        seen.set(key, row.rowId)
      } else {
        const firstErrors = errors.get(first)
        const currentErrors = errors.get(row.rowId)
        if (firstErrors) firstErrors.crusherReceipt = t('tripGrid.validation.duplicateReceipt')
        if (currentErrors) currentErrors.crusherReceipt = t('tripGrid.validation.duplicateReceipt')
      }
    }
    return errors
  }, [rows, shiftId, t, validateTripPayload])

  const validCount = useMemo(
    () =>
      rows.filter((row) => {
        const built = buildTripPayload(row, shiftId)
        return (
          built.payload !== undefined &&
          validateTripPayload(built.payload).length === 0 &&
          Object.keys(errorsByRow.get(row.rowId) ?? {}).length === 0
        )
      }).length,
    [errorsByRow, rows, shiftId, validateTripPayload]
  )

  return { errorsByRow, validCount }
}
