import { isCubicQuantityHigh, parseNumberCell } from '@/lib/tripGrid'
import type { TripGridColumn, TripGridRow } from '@/lib/tripGrid'

export type PriceColumn = 'stonePrice' | 'transportPrice' | 'clientPrice'
export type SuggestionSource = 'LAST_TRIP' | 'DEFAULT' | null
export type SuggestedPrices = {
  stonePrice: number | null
  clientPrice: number | null
  transportPrice: number | null
  sources: {
    stonePrice: SuggestionSource
    clientPrice: SuggestionSource
    transportPrice: 'LAST_TRIP' | null
  }
}
export type GridRow = TripGridRow & {
  rowId: number
  priceEdited: Partial<Record<PriceColumn, boolean>>
  suggested: Partial<Record<PriceColumn, boolean>>
  suggestionSources: Partial<Record<PriceColumn, Exclude<SuggestionSource, null>>>
  serverErrors: Partial<Record<TripGridColumn, string>>
  rowMessage: string
}
export type TripEntryShift = {
  id: string
  vehicleNo: number
  startDate: string
  crusherCubicDefault: number
  clientCubicDefault: number
}
export type GridColumn = {
  key: TripGridColumn
  label: string
  kind: 'text' | 'number' | 'money' | 'date' | 'receipt' | 'name'
  list?: string
}
export type TripGridCellErrors = Partial<Record<TripGridColumn, string>>
export type TripGridDefaults = {
  shiftId: string
  clientCubicDefault: number
  crusherCubicDefault: number
}
export type TripGridNames = {
  clients: { id: number; name: string }[]
  crushers: { id: number; name: string }[]
  materialTypes: { id: number; name: string }[]
}

export const coreColumns: Omit<GridColumn, 'label'>[] = [
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

export const extraColumns: Omit<GridColumn, 'label'>[] = [
  { key: 'clientReceiptNo', kind: 'text' },
  { key: 'recipient', kind: 'text' },
  { key: 'location', kind: 'text' },
  { key: 'fineAmount', kind: 'money' },
  { key: 'fineReason', kind: 'text' }
]

export const priceColumns: PriceColumn[] = ['stonePrice', 'transportPrice', 'clientPrice']

export function isPriceColumn(column: TripGridColumn): column is PriceColumn {
  return column === 'stonePrice' || column === 'transportPrice' || column === 'clientPrice'
}

export function today(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function createRow(
  rowId: number,
  defaults: Pick<TripEntryShift, 'clientCubicDefault' | 'crusherCubicDefault'>,
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

export function fieldValue(row: GridRow, key: TripGridColumn): string {
  return row[key]
}

export function hasHighCubicWarning(row: GridRow, column: TripGridColumn): boolean {
  if (column !== 'clientCubic' && column !== 'crusherCubic') return false
  const parsed = parseNumberCell(row[column], { allowGrouping: false })
  return parsed.ok && parsed.value !== null && isCubicQuantityHigh(parsed.value)
}

export function isEmpty(row: GridRow): boolean {
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
