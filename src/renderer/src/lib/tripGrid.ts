export type TripGridColumn =
  | 'tripDate'
  | 'client'
  | 'crusher'
  | 'materialType'
  | 'clientCubic'
  | 'crusherCubic'
  | 'stonePrice'
  | 'transportPrice'
  | 'clientPrice'
  | 'crusherReceipt'
  | 'notes'
  | 'clientReceiptNo'
  | 'recipient'
  | 'location'
  | 'fineAmount'
  | 'fineReason'

export interface TripGridRow {
  tripDate: string
  client: string
  crusher: string
  materialType: string
  clientId?: number
  crusherId?: number
  materialTypeId?: number
  clientCubic: string
  crusherCubic: string
  stonePrice: string
  transportPrice: string
  clientPrice: string
  crusherReceipt: string
  notes: string
  clientReceiptNo: string
  recipient: string
  location: string
  fineAmount: string
  fineReason: string
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; message: string }

export interface ParsedReceipt {
  crusherReceiptStatus: 'UNKNOWN' | 'PROVIDED' | 'CONFIRMED_MISSING'
  crusherReceiptNo?: number
}

export interface ParsedRecipient {
  recipientNameStatus: 'UNCLEAR' | 'PROVIDED'
  recipientName?: string
}

export interface TripGridPayload {
  shiftId: string
  tripDate: string
  clientId: number
  crusherId: number
  materialTypeId: number
  clientCubicReported: number
  crusherCubic: number
  stonePrice: number
  transportPrice: number
  clientPrice: number
  crusherReceiptStatus: ParsedReceipt['crusherReceiptStatus']
  crusherReceiptNo?: number
  notes?: string
  clientReceiptNo?: string
  recipientNameStatus: ParsedRecipient['recipientNameStatus']
  recipientName?: string
  location?: string
  fineAmount?: number
  fineReason?: string
}

export function normalizeDigits(value: string): string {
  return value
    .replace(/[\u0660-\u0669\u06f0-\u06f9]/g, (digit) =>
      String(digit.charCodeAt(0) - (digit.charCodeAt(0) >= 0x06f0 ? 0x06f0 : 0x0660))
    )
    .replace(/\u066b/g, '.')
    .replace(/\u066c/g, ',')
}

export function parseNumberCell(
  input: string,
  options: { money?: boolean; allowGrouping?: boolean } = {}
): ParseResult<number | null> {
  const value = normalizeDigits(input).trim()
  if (!value) return { ok: true, value: null }
  const validNumber =
    options.allowGrouping === false
      ? /^-?\d+(?:\.\d+)?$/.test(value)
      : /^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(value)
  if (!validNumber) {
    return { ok: false, message: 'invalid' }
  }
  const decimals = value.split('.')[1]?.length ?? 0
  if (options.money && decimals > 2) return { ok: false, message: 'decimals' }
  const parsed = Number(value.replace(/,/g, ''))
  if (!Number.isFinite(parsed)) return { ok: false, message: 'invalid' }
  return { ok: true, value: parsed }
}

export function isCubicQuantityHigh(value: number): boolean {
  return value > 150
}

export function parseDateCell(input: string): ParseResult<string> {
  const value = normalizeDigits(input).trim()
  let normalized = value
  const slashDate = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value)
  if (slashDate) {
    normalized = `${slashDate[3]}-${slashDate[2].padStart(2, '0')}-${slashDate[1].padStart(2, '0')}`
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return { ok: false, message: value ? 'invalid' : 'required' }
  }
  const date = new Date(`${normalized}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized) {
    return { ok: false, message: 'invalid' }
  }
  return { ok: true, value: normalized }
}

export function parseReceiptCell(input: string): ParseResult<ParsedReceipt> {
  const value = normalizeDigits(input).trim()
  if (!value) return { ok: true, value: { crusherReceiptStatus: 'UNKNOWN' } }
  if (value === '-') return { ok: true, value: { crusherReceiptStatus: 'CONFIRMED_MISSING' } }
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0) {
    return { ok: false, message: 'invalid' }
  }
  return {
    ok: true,
    value: { crusherReceiptStatus: 'PROVIDED', crusherReceiptNo: Number(value) }
  }
}

export function parseRecipientCell(input: string): ParsedRecipient {
  const value = input.trim()
  return value
    ? { recipientNameStatus: 'PROVIDED', recipientName: value }
    : { recipientNameStatus: 'UNCLEAR' }
}

export function parsePaste(input: string, knownColumnLabels: string[] = []): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const value = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]
    if (character === '"') {
      if (quoted && value[index + 1] === '"') {
        cell += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (!quoted && (character === '\t' || character === '\n')) {
      row.push(cell)
      cell = ''
      if (character === '\n') {
        rows.push(row)
        row = []
      }
    } else {
      cell += character
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  const populatedRows = rows.filter((cells) => cells.some((value) => value.trim().length > 0))
  if (populatedRows[0] && knownColumnLabels.includes(populatedRows[0][0])) populatedRows.shift()
  return populatedRows
}

export type NameResolution = { id: number } | { ambiguous: true } | null

export function resolveName(
  input: string,
  options: { id: number; name: string }[]
): NameResolution {
  const normalize = (value: string): string =>
    value
      .replace(/[\u064b-\u0652\u0670\u0640]/g, '')
      .replace(/[\u0622-\u0625\u0671-\u0675]/g, '\u0627')
      .replace(/\u0649/g, '\u064a')
      .replace(/\u0629/g, '\u0647')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase()
  const normalized = normalize(input)
  if (!normalized) return null
  const matchingIds = [
    ...new Set(
      options.filter((option) => normalize(option.name) === normalized).map(({ id }) => id)
    )
  ]
  if (matchingIds.length > 1) return { ambiguous: true }
  return matchingIds.length === 1 ? { id: matchingIds[0] } : null
}

export interface TripGridBuildResult {
  payload?: TripGridPayload
  errors: Partial<Record<TripGridColumn, string>>
}

export function buildTripPayload(row: TripGridRow, shiftId: string): TripGridBuildResult {
  const errors: Partial<Record<TripGridColumn, string>> = {}
  const date = parseDateCell(row.tripDate)
  if (!date.ok) errors.tripDate = date.message
  const receipt = parseReceiptCell(row.crusherReceipt)
  if (!receipt.ok) errors.crusherReceipt = receipt.message
  const parsedReceipt: ParsedReceipt = receipt.ok
    ? receipt.value
    : { crusherReceiptStatus: 'UNKNOWN' }
  const numberFields: {
    field:
      | 'clientCubic'
      | 'crusherCubic'
      | 'stonePrice'
      | 'transportPrice'
      | 'clientPrice'
      | 'fineAmount'
    input: string
    money: boolean
    allowGrouping: boolean
  }[] = [
    { field: 'clientCubic', input: row.clientCubic, money: false, allowGrouping: false },
    { field: 'crusherCubic', input: row.crusherCubic, money: false, allowGrouping: false },
    { field: 'stonePrice', input: row.stonePrice, money: true, allowGrouping: true },
    { field: 'transportPrice', input: row.transportPrice, money: true, allowGrouping: true },
    { field: 'clientPrice', input: row.clientPrice, money: true, allowGrouping: true },
    { field: 'fineAmount', input: row.fineAmount, money: true, allowGrouping: true }
  ]
  const parsedNumbers: Partial<
    Record<
      | 'clientCubic'
      | 'crusherCubic'
      | 'stonePrice'
      | 'transportPrice'
      | 'clientPrice'
      | 'fineAmount',
      number | null
    >
  > = {}
  for (const { field, input, money, allowGrouping } of numberFields) {
    const parsedNumber = parseNumberCell(input, { money, allowGrouping })
    if (!parsedNumber.ok) errors[field] = parsedNumber.message
    else parsedNumbers[field] = parsedNumber.value
  }
  const requiredNumberFields: (
    'clientCubic' | 'crusherCubic' | 'stonePrice' | 'transportPrice' | 'clientPrice'
  )[] = ['clientCubic', 'crusherCubic', 'stonePrice', 'transportPrice', 'clientPrice']
  for (const field of requiredNumberFields) {
    if (parsedNumbers[field] === null) errors[field] = 'required'
  }
  if (!row.clientId) errors.client = 'required'
  if (!row.crusherId) errors.crusher = 'required'
  if (!row.materialTypeId) errors.materialType = 'required'
  const requiredNumber = (
    field: 'clientCubic' | 'crusherCubic' | 'stonePrice' | 'transportPrice' | 'clientPrice'
  ): number => parsedNumbers[field] ?? 0
  const payload: TripGridPayload = {
    shiftId,
    tripDate: date.ok ? date.value : '',
    clientId: row.clientId ?? 0,
    crusherId: row.crusherId ?? 0,
    materialTypeId: row.materialTypeId ?? 0,
    clientCubicReported: requiredNumber('clientCubic'),
    crusherCubic: requiredNumber('crusherCubic'),
    stonePrice: requiredNumber('stonePrice'),
    transportPrice: requiredNumber('transportPrice'),
    clientPrice: requiredNumber('clientPrice'),
    ...parsedReceipt,
    recipientNameStatus: parseRecipientCell(row.recipient).recipientNameStatus,
    notes: row.notes || undefined,
    clientReceiptNo: row.clientReceiptNo || undefined,
    recipientName: parseRecipientCell(row.recipient).recipientName,
    location: row.location || undefined,
    fineAmount: parsedNumbers.fineAmount ?? undefined,
    fineReason: row.fineReason || undefined
  }
  return { payload, errors }
}

export function mapServerErrors(errors: { field: string; message: string }[]): {
  cells: Partial<Record<TripGridColumn, string>>
  rowMessage: string
} {
  const cells: Partial<Record<TripGridColumn, string>> = {}
  const fieldColumns: Record<string, TripGridColumn> = {
    tripDate: 'tripDate',
    clientId: 'client',
    crusherId: 'crusher',
    materialTypeId: 'materialType',
    clientCubicReported: 'clientCubic',
    crusherCubic: 'crusherCubic',
    stonePrice: 'stonePrice',
    transportPrice: 'transportPrice',
    clientPrice: 'clientPrice',
    crusherReceiptNo: 'crusherReceipt',
    crusherReceiptStatus: 'crusherReceipt',
    recipientName: 'recipient',
    recipientNameStatus: 'recipient',
    clientReceiptNo: 'clientReceiptNo',
    notes: 'notes',
    location: 'location',
    fineAmount: 'fineAmount',
    fineReason: 'fineReason'
  }
  const rowMessages: string[] = []
  for (const error of errors) {
    const column = fieldColumns[error.field]
    if (column) cells[column] = error.message
    else rowMessages.push(error.message)
  }
  return { cells, rowMessage: rowMessages.join(', ') }
}
