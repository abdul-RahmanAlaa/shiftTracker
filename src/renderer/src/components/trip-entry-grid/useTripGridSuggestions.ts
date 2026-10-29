import { useEffect, useRef } from 'react'
import { ipcApi } from '@/lib/ipcErrors'
import { createLatestGuard } from '@/lib/latestGuard'
import { parseNumberCell } from '@/lib/tripGrid'
import type { TripGridColumn } from '@/lib/tripGrid'
import type { GridRow, PriceColumn, SuggestionSource, SuggestedPrices } from './tripEntryGridTypes'

function priceColumnsForKey(column: TripGridColumn): PriceColumn[] {
  if (column === 'client') return ['clientPrice', 'transportPrice']
  if (column === 'crusher') return ['stonePrice']
  if (column === 'materialType') return ['stonePrice', 'clientPrice']
  if (column === 'location') return ['transportPrice']
  return []
}

function localPrice(
  column: PriceColumn,
  row: GridRow,
  rowIndex: number,
  sourceRows: GridRow[]
): number | null {
  const candidates = sourceRows.slice(0, rowIndex).reverse()
  for (const candidate of candidates) {
    const matchesKey =
      column === 'stonePrice'
        ? Boolean(
            row.crusherId &&
            row.materialTypeId &&
            candidate.crusherId === row.crusherId &&
            candidate.materialTypeId === row.materialTypeId
          )
        : column === 'clientPrice'
          ? Boolean(
              row.clientId &&
              row.materialTypeId &&
              candidate.clientId === row.clientId &&
              candidate.materialTypeId === row.materialTypeId
            )
          : (() => {
              const rowLocation = row.location.trim()
              const candidateLocation = candidate.location.trim()
              return Boolean(
                row.clientId &&
                candidate.clientId === row.clientId &&
                (!rowLocation || !candidateLocation || rowLocation === candidateLocation)
              )
            })()
    if (!matchesKey) continue
    const parsed = parseNumberCell(candidate[column], { money: true })
    if (parsed.ok && parsed.value !== null && parsed.value > 0) return parsed.value
  }
  return null
}

export function useTripGridSuggestions({
  rows,
  updateRow,
  resetKey
}: {
  rows: GridRow[]
  updateRow: (rowId: number, update: (row: GridRow) => GridRow) => void
  resetKey: object
}): {
  refreshPriceSuggestions: (
    rowId: number,
    row: GridRow,
    changedKeys: TripGridColumn[],
    sourceRows?: GridRow[]
  ) => Promise<void>
  clearCache: () => void
} {
  const suggestionGuards = useRef(new Map<number, ReturnType<typeof createLatestGuard>>())
  const pendingSuggestionColumns = useRef(new Map<number, Set<PriceColumn>>())
  const suggestionCache = useRef(new Map<string, Promise<SuggestedPrices | null>>())

  useEffect(() => {
    suggestionCache.current.clear()
    const guards = suggestionGuards.current
    return () => {
      for (const guard of guards.values()) guard.cancel()
    }
  }, [resetKey])

  function setPriceSuggestion(
    rowId: number,
    column: PriceColumn,
    value: number | null,
    source: SuggestionSource
  ): void {
    updateRow(rowId, (current) => {
      if (current.priceEdited[column]) return current
      return {
        ...current,
        [column]: value === null ? '' : String(value),
        suggested: { ...current.suggested, [column]: value !== null },
        suggestionSources: {
          ...current.suggestionSources,
          [column]: source ?? undefined
        }
      }
    })
  }

  async function refreshPriceSuggestions(
    rowId: number,
    row: GridRow,
    changedKeys: TripGridColumn[],
    sourceRows: GridRow[] = rows
  ): Promise<void> {
    const affectedColumns = new Set(changedKeys.flatMap(priceColumnsForKey))
    if (affectedColumns.size === 0) return

    let guard = suggestionGuards.current.get(rowId)
    if (!guard) {
      guard = createLatestGuard()
      suggestionGuards.current.set(rowId, guard)
    }
    const token = guard.next()
    const pending = pendingSuggestionColumns.current.get(rowId) ?? new Set<PriceColumn>()
    for (const column of affectedColumns) pending.add(column)
    pendingSuggestionColumns.current.set(rowId, pending)

    const currentRows = sourceRows.map((candidate) => (candidate.rowId === rowId ? row : candidate))
    const currentIndex = currentRows.findIndex((candidate) => candidate.rowId === rowId)
    const changedColumn = [...pending]
    const local = new Map<PriceColumn, number | null>()
    for (const column of changedColumn) {
      local.set(
        column,
        currentIndex < 0 ? null : localPrice(column, row, currentIndex, currentRows)
      )
    }

    if (!row.clientId || !row.crusherId) {
      for (const column of changedColumn)
        setPriceSuggestion(
          rowId,
          column,
          local.get(column) ?? null,
          local.get(column) === null ? null : 'LAST_TRIP'
        )
      return
    }

    const needsServer = changedColumn.some((column) => local.get(column) === null)
    let serverPrices: SuggestedPrices | null = null
    if (needsServer) {
      const materialTypeId = row.materialTypeId
      const location = row.location.trim()
      const input = {
        clientId: row.clientId,
        crusherId: row.crusherId,
        ...(materialTypeId === undefined ? {} : { materialTypeId }),
        ...(location ? { location } : {})
      }
      const cacheKey = JSON.stringify([
        input.clientId,
        input.crusherId,
        input.materialTypeId ?? null,
        input.location ?? null
      ])
      let request = suggestionCache.current.get(cacheKey)
      if (!request) {
        request = ipcApi
          .getSuggestedTripPrices(input)
          .then((result) => (result.ok ? result.data : null))
        suggestionCache.current.set(cacheKey, request)
      }
      serverPrices = await request
      if (!guard.isLatest(token)) return
    }
    pendingSuggestionColumns.current.delete(rowId)

    for (const column of changedColumn) {
      const localValue = local.get(column) ?? null
      if (localValue !== null) {
        setPriceSuggestion(rowId, column, localValue, 'LAST_TRIP')
        continue
      }
      const suggestedValue = serverPrices?.[column] ?? null
      const source = serverPrices?.sources[column] ?? null
      setPriceSuggestion(rowId, column, suggestedValue, source)
    }
  }

  return {
    refreshPriceSuggestions,
    clearCache: () => suggestionCache.current.clear()
  }
}
