import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ipcApi, showErrorNotice, showSuccessNotice } from '@/lib/ipcErrors'
import { buildTripPayload, mapServerErrors } from '@/lib/tripGrid'
import type { TripGridPayload } from '@/lib/tripGrid'
import type { GridRow, TripGridCellErrors, TripGridDefaults } from './tripEntryGridTypes'

export function useTripGridSave({
  rows,
  rowDefaults,
  errorsByRow,
  validateTripPayload,
  setRows,
  updateRow,
  clearSuggestionCache,
  onRefresh
}: {
  rows: GridRow[]
  rowDefaults: TripGridDefaults
  errorsByRow: Map<number, TripGridCellErrors>
  validateTripPayload: (payload: TripGridPayload) => { field: string; message: string }[]
  setRows: React.Dispatch<React.SetStateAction<GridRow[]>>
  updateRow: (rowId: number, update: (row: GridRow) => GridRow) => void
  clearSuggestionCache: () => void
  onRefresh: () => Promise<void>
}): { saving: boolean; saveAll: () => Promise<void> } {
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)

  async function saveAll(): Promise<void> {
    if (savingRef.current) return
    savingRef.current = true
    try {
      const valid = rows.filter((row) => {
        const built = buildTripPayload(row, rowDefaults.shiftId)
        return (
          built.payload !== undefined &&
          validateTripPayload(built.payload).length === 0 &&
          Object.keys(errorsByRow.get(row.rowId) ?? {}).length === 0
        )
      })
      if (!valid.length) return
      setSaving(true)
      let savedCount = 0
      let failedCount = 0
      for (const row of valid) {
        const built = buildTripPayload(row, rowDefaults.shiftId)
        if (!built.payload) continue
        if (validateTripPayload(built.payload).length > 0) continue
        const response = await ipcApi.createTrip(built.payload)
        if (response.ok) {
          savedCount += 1
          setRows((current) => current.filter((item) => item.rowId !== row.rowId))
        } else {
          failedCount += 1
          const mapped = mapServerErrors(response.errors)
          updateRow(row.rowId, (current) => ({
            ...current,
            serverErrors: mapped.cells,
            rowMessage: mapped.rowMessage
          }))
        }
      }
      clearSuggestionCache()
      await onRefresh()
      if (savedCount) showSuccessNotice(t('tripGrid.savedNotice', { count: savedCount }))
      if (failedCount) showErrorNotice(t('tripGrid.failedNotice', { count: failedCount }))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return { saving, saveAll }
}
