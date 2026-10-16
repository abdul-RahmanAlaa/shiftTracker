import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Copy, Trash2, Columns3, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ipcApi, showErrorNotice, showSuccessNotice } from '@/lib/ipcErrors'
import { createLatestGuard } from '@/lib/latestGuard'
import {
  buildTripPayload,
  isCubicQuantityHigh,
  mapServerErrors,
  parseDateCell,
  parseNumberCell,
  parsePaste,
  parseReceiptCell,
  resolveName
} from '@/lib/tripGrid'
import type { TripGridColumn, TripGridRow } from '@/lib/tripGrid'
import type { ResourceState } from '@/pages/AddTripPage'
import type { TripGridPayload } from '@/lib/tripGrid'

type PriceColumn = 'stonePrice' | 'transportPrice' | 'clientPrice'
type SuggestionSource = 'LAST_TRIP' | 'DEFAULT' | null
type SuggestedPrices = {
  stonePrice: number | null
  clientPrice: number | null
  transportPrice: number | null
  sources: {
    stonePrice: SuggestionSource
    clientPrice: SuggestionSource
    transportPrice: 'LAST_TRIP' | null
  }
}
type GridRow = TripGridRow & {
  rowId: number
  priceEdited: Partial<Record<PriceColumn, boolean>>
  suggested: Partial<Record<PriceColumn, boolean>>
  suggestionSources: Partial<Record<PriceColumn, Exclude<SuggestionSource, null>>>
  serverErrors: Partial<Record<TripGridColumn, string>>
  rowMessage: string
}
type Shift = {
  id: string
  vehicleNo: number
  startDate: string
  crusherCubicDefault: number
  clientCubicDefault: number
}
type Column = {
  key: TripGridColumn
  label: string
  kind: 'text' | 'number' | 'money' | 'date' | 'receipt' | 'name'
  list?: string
}

const coreColumns: Omit<Column, 'label'>[] = [
  { key: 'tripDate', kind: 'date' },
  { key: 'client', kind: 'name', list: 'trip-grid-clients' },
  { key: 'crusher', kind: 'name', list: 'trip-grid-crushers' },
  { key: 'materialType', kind: 'name', list: 'trip-grid-materials' },
  { key: 'clientCubic', kind: 'number' },
  { key: 'crusherCubic', kind: 'number' },
  { key: 'stonePrice', kind: 'money' },
  { key: 'transportPrice', kind: 'money' },
  { key: 'clientPrice', kind: 'money' },
  { key: 'crusherReceipt', kind: 'receipt' },
  { key: 'notes', kind: 'text' }
]
const extraColumns: Omit<Column, 'label'>[] = [
  { key: 'clientReceiptNo', kind: 'text' },
  { key: 'recipient', kind: 'text' },
  { key: 'location', kind: 'text' },
  { key: 'fineAmount', kind: 'money' },
  { key: 'fineReason', kind: 'text' }
]
const priceColumns: PriceColumn[] = ['stonePrice', 'transportPrice', 'clientPrice']

function isPriceColumn(column: TripGridColumn): column is PriceColumn {
  return column === 'stonePrice' || column === 'transportPrice' || column === 'clientPrice'
}

function today(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function createRow(
  rowId: number,
  defaults: Pick<Shift, 'clientCubicDefault' | 'crusherCubicDefault'>,
  previousDate?: string
): GridRow {
  return {
    rowId,
    tripDate: previousDate || today(),
    client: '',
    crusher: '',
    materialType: '',
    clientCubic: String(defaults.clientCubicDefault),
    crusherCubic: String(defaults.crusherCubicDefault),
    stonePrice: '',
    transportPrice: '',
    clientPrice: '',
    crusherReceipt: '',
    notes: '',
    clientReceiptNo: '',
    recipient: '',
    location: '',
    fineAmount: '',
    fineReason: '',
    priceEdited: {},
    suggested: {},
    suggestionSources: {},
    serverErrors: {},
    rowMessage: ''
  }
}

function fieldValue(row: GridRow, key: TripGridColumn): string {
  return row[key]
}

function hasHighCubicWarning(row: GridRow, column: TripGridColumn): boolean {
  if (column !== 'clientCubic' && column !== 'crusherCubic') return false
  const parsed = parseNumberCell(row[column], { allowGrouping: false })
  return parsed.ok && parsed.value !== null && isCubicQuantityHigh(parsed.value)
}

export function TripEntryGrid({
  shift,
  resources,
  validateTripPayload,
  onRefresh
}: {
  shift: Shift
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
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [selectedRowId, setSelectedRowId] = useState<number>()
  const rowIdRef = useRef(0)
  const inputRefs = useRef(new Map<string, HTMLInputElement>())
  const suggestionGuards = useRef(new Map<number, ReturnType<typeof createLatestGuard>>())
  const pendingSuggestionColumns = useRef(new Map<number, Set<PriceColumn>>())
  const pendingFocus = useRef<{ rowIndex: number; column: TripGridColumn } | null>(null)
  const suggestionCache = useRef(new Map<string, Promise<SuggestedPrices | null>>())
  const names = {
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
  const columns = [...coreColumns, ...(showExtras ? extraColumns : [])].map((column) => ({
    ...column,
    label: labelFor(column.key)
  }))

  useEffect(() => {
    const first = createRow(++rowIdRef.current, rowDefaults)
    setRows([first])
    setSelectedRowId(first.rowId)
    suggestionCache.current.clear()
    const guards = suggestionGuards.current
    return () => {
      for (const guard of guards.values()) guard.cancel()
    }
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
    const built = buildTripPayload(row, rowDefaults.shiftId)
    if (!isEmpty(row)) {
      for (const column of [...coreColumns, ...extraColumns]) {
        const message = built.errors[column.key]
        if (message) errors[column.key] ??= t(`tripGrid.validation.${message}`)
      }
    }
    if (built.payload) {
      if (!isEmpty(row)) {
        const issues = validateTripPayload(built.payload)
        if (issues.length > 0) {
          const mapped = mapServerErrors(issues)
          for (const column of [...coreColumns, ...extraColumns]) {
            const message = mapped.cells[column.key]
            if (message) errors[column.key] ??= message
          }
        }
      }
    }
    return errors
  }

  function errorsForRows(): Map<number, Partial<Record<TripGridColumn, string>>> {
    const errorsByRow = new Map(rows.map((row) => [row.rowId, rowErrors(row)]))
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
        const firstErrors = errorsByRow.get(first)
        const currentErrors = errorsByRow.get(row.rowId)
        if (firstErrors) firstErrors.crusherReceipt = t('tripGrid.validation.duplicateReceipt')
        if (currentErrors) currentErrors.crusherReceipt = t('tripGrid.validation.duplicateReceipt')
      }
    }
    return errorsByRow
  }

  function isEmpty(row: GridRow): boolean {
    return (
      !row.client &&
      !row.crusher &&
      !row.materialType &&
      !row.stonePrice &&
      !row.transportPrice &&
      !row.clientPrice &&
      !row.crusherReceipt &&
      !row.notes &&
      !row.clientReceiptNo &&
      !row.recipient &&
      !row.location &&
      !row.fineAmount &&
      !row.fineReason
    )
  }

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
    updateRow(rowId, (row) => {
      return {
        ...row,
        [column]: value,
        ...(column === 'client' ? { clientId: resolvedId } : {}),
        ...(column === 'crusher' ? { crusherId: resolvedId } : {}),
        ...(column === 'materialType' ? { materialTypeId: resolvedId } : {}),
        serverErrors: { ...row.serverErrors, [column]: undefined }
      }
    })
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
    if (priceColumnsForKey(column).length > 0)
      void refreshPriceSuggestions(rowId, updated, [column])
  }

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
    event: React.ClipboardEvent<HTMLInputElement>,
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
        if (priceColumnsForKey(column.key).length > 0) changedKeys.push(column.key)
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
    event: React.KeyboardEvent<HTMLInputElement>,
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

  async function saveAll(): Promise<void> {
    if (savingRef.current) return
    savingRef.current = true
    try {
      const errorsByRow = errorsForRows()
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
      suggestionCache.current.clear()
      await onRefresh()
      if (savedCount) showSuccessNotice(t('tripGrid.savedNotice', { count: savedCount }))
      if (failedCount) showErrorNotice(t('tripGrid.failedNotice', { count: failedCount }))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const errorsByRow = errorsForRows()
  const validCount = rows.filter((row) => {
    const built = buildTripPayload(row, rowDefaults.shiftId)
    return (
      built.payload !== undefined &&
      validateTripPayload(built.payload).length === 0 &&
      Object.keys(errorsByRow.get(row.rowId) ?? {}).length === 0
    )
  }).length
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
          onClick={() => {
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
          }}
        >
          <Copy className="h-4 w-4" /> {t('tripGrid.duplicateRow')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={saving || selectedRowId === undefined}
          onClick={() => {
            setRows((current) => current.filter((row) => row.rowId !== selectedRowId))
            setSelectedRowId(rows.find((row) => row.rowId !== selectedRowId)?.rowId)
          }}
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
            {rows.map((row, rowIndex) => {
              const errors = errorsByRow.get(row.rowId) ?? {}
              const rowStatus = isEmpty(row)
                ? 'empty'
                : Object.keys(errors).length
                  ? 'error'
                  : 'ready'
              return (
                <Fragment key={row.rowId}>
                  <tr onFocus={() => setSelectedRowId(row.rowId)}>
                    {columns.map((column, columnIndex) => (
                      <td key={column.key} className="border-b px-1 py-1 align-top">
                        <Input
                          ref={(element) => {
                            const key = `${row.rowId}:${column.key}`
                            if (element) inputRefs.current.set(key, element)
                            else inputRefs.current.delete(key)
                          }}
                          value={fieldValue(row, column.key)}
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
                          className={`h-8 min-w-24 ${priceColumns.some((priceColumn) => priceColumn === column.key && row.suggested[priceColumn]) ? 'bg-amber-50 dark:bg-amber-950' : ''} ${
                            hasHighCubicWarning(row, column.key)
                              ? 'border-amber-500 bg-amber-50 ring-1 ring-amber-500 dark:bg-amber-950'
                              : ''
                          }`}
                          onChange={(event) =>
                            changeCell(row.rowId, column.key, event.target.value)
                          }
                          onBlur={(event) => {
                            if (column.kind === 'name')
                              resolveCellName(row.rowId, column.key, event.target.value)
                          }}
                          onPaste={(event) => handlePaste(event, rowIndex, columnIndex)}
                          onKeyDown={(event) => handleKeyDown(event, rowIndex, columnIndex)}
                        />
                        {errors[column.key] && (
                          <p className="mt-1 max-w-40 text-xs text-destructive">
                            {errors[column.key]}
                          </p>
                        )}
                      </td>
                    ))}
                    <td className="whitespace-nowrap border-b px-2 py-1 align-top">
                      <span className="me-2">{t(`tripGrid.rowStatus.${rowStatus}`)}</span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={saving}
                        aria-label={t('tripGrid.deleteRow')}
                        onClick={() => {
                          setRows((current) => current.filter((item) => item.rowId !== row.rowId))
                          setSelectedRowId(rows.find((item) => item.rowId !== row.rowId)?.rowId)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                  {(row.rowMessage || Object.keys(errors).length > 0) && (
                    <tr>
                      <td
                        colSpan={columns.length + 1}
                        className="border-b px-2 py-1 text-xs text-destructive"
                      >
                        {row.rowMessage ||
                          t('tripGrid.rowErrors', {
                            errors: [...new Set(Object.values(errors))].join(', ')
                          })}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
