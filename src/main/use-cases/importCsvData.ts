import Papa from 'papaparse'
import { backupDatabase } from '../backup'
import { getDb } from '../db'
import { getClientIdByName } from '../repository/clientRepository'
import { getCrusherIdByName } from '../repository/crusherRepository'
import { getDriverIdByName } from '../repository/driverRepository'
import { insertImportedShift, getNextShiftId } from '../repository/shiftRepository'
import { getNextTripId, insertTrip } from '../repository/tripRepository'
import { vehicleExists } from '../repository/vehicleRepository'

export interface ImportRowError {
  row: number
  field: string
  message: string
}

export interface ImportSummary {
  shiftsCreated: number
  tripsCreated: number
}

type ImportResult = { ok: true; data: ImportSummary } | { ok: false; errors: ImportRowError[] }

type RawCsvRow = Record<string, string | undefined>

interface ValidatedRow {
  oldShiftNo: string
  driverId: number
  vehicleNo: number
  shiftStartDate: string
  shiftEndDate: string | null
  shiftCrusherCubicDefault: number
  shiftClientCubicDefault: number
  tripDate: string
  crusherCubic: number
  clientCubicReported: number
  discountQty: number
  discountReason: string | null
  location: string | null
  crusherId: number
  stonePrice: number | null
  crusherReceiptStatus: string
  crusherReceiptNo: number | null
  clientId: number
  transportPrice: number
  clientPrice: number
  recipientNameStatus: string
  recipientName: string | null
  clientReceiptNo: string | null
  notes: string | null
}

const requiredHeaders = [
  'old_shift_no',
  'driver_name',
  'vehicle_no',
  'shift_start_date',
  'shift_end_date',
  'shift_crusher_cubic_default',
  'shift_client_cubic_default',
  'trip_date',
  'crusher_cubic',
  'client_cubic_reported',
  'crusher_receipt_status',
  'crusher_name',
  'stone_price',
  'client_name',
  'transport_price',
  'client_price',
  'recipient_name_status'
]

const validCrusherReceiptStatuses = new Set(['قيمة', 'مفيش (متأكد)', 'مش معروف'])
const validRecipientNameStatuses = new Set(['قيمة', 'مش واضح'])
const templateDescriptionSentinel = 'احذف هذا السطر قبل الرفع'

interface SqliteError extends Error {
  code: string
}

function isSqliteError(error: unknown): error is SqliteError {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  )
}

function text(value: string | undefined): string {
  return value?.trim() ?? ''
}

function parseNumber(
  value: string | undefined,
  row: number,
  field: string,
  errors: ImportRowError[],
  integer = false
): number | undefined {
  const valueText = text(value)
  if (!valueText) {
    errors.push({ row, field, message: 'القيمة مطلوبة' })
    return undefined
  }
  const parsed = Number(valueText)
  if (!Number.isFinite(parsed) || (integer && !Number.isInteger(parsed))) {
    errors.push({ row, field, message: 'القيمة لازم تكون رقمًا صحيحًا' })
    return undefined
  }
  return parsed
}

function parseOptionalNumber(
  value: string | undefined,
  row: number,
  field: string,
  errors: ImportRowError[]
): number | undefined {
  const valueText = text(value)
  if (!valueText) return undefined
  const parsed = Number(valueText)
  if (!Number.isFinite(parsed)) {
    errors.push({ row, field, message: 'القيمة لازم تكون رقمًا' })
    return undefined
  }
  return parsed
}

function validateDate(
  value: string | undefined,
  row: number,
  field: string,
  errors: ImportRowError[]
): string {
  const valueText = text(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valueText)) {
    errors.push({ row, field, message: 'التاريخ لازم يكون بصيغة YYYY-MM-DD' })
  }
  return valueText
}

export function importCsvData(input: { csvText: string }): ImportResult {
  if (!input.csvText?.trim()) {
    return { ok: false, errors: [{ row: 0, field: 'csvText', message: 'ملف CSV فاضي' }] }
  }

  const parsed = Papa.parse<RawCsvRow>(input.csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim()
  })
  const errors: ImportRowError[] = []
  parsed.errors.forEach((error) => {
    errors.push({ row: (error.row ?? 0) + 2, field: 'csv', message: error.message })
  })

  const headers = parsed.meta.fields ?? []
  requiredHeaders.forEach((header) => {
    if (!headers.includes(header)) {
      errors.push({ row: 1, field: header, message: `العمود ${header} غير موجود` })
    }
  })
  if (errors.length > 0) return { ok: false, errors }

  const missingDrivers = new Map<string, number>()
  const missingCrushers = new Map<string, number>()
  const missingClients = new Map<string, number>()
  const missingVehicles = new Map<number, number>()
  const validRows: ValidatedRow[] = []

  parsed.data.forEach((raw, index) => {
    if (text(raw.old_shift_no) === templateDescriptionSentinel) return
    const row = index + 2
    const oldShiftNo = text(raw.old_shift_no)
    const driverName = text(raw.driver_name)
    const crusherName = text(raw.crusher_name)
    const clientName = text(raw.client_name)
    if (!oldShiftNo)
      errors.push({ row, field: 'old_shift_no', message: 'رقم الوردية القديم مطلوب' })
    if (!driverName) errors.push({ row, field: 'driver_name', message: 'اسم السائق مطلوب' })
    if (!crusherName) errors.push({ row, field: 'crusher_name', message: 'اسم الكسارة مطلوب' })
    if (!clientName) errors.push({ row, field: 'client_name', message: 'اسم العميل مطلوب' })

    const vehicleNo = parseNumber(raw.vehicle_no, row, 'vehicle_no', errors, true)
    const shiftCrusherCubicDefault = parseNumber(
      raw.shift_crusher_cubic_default,
      row,
      'shift_crusher_cubic_default',
      errors
    )
    const shiftClientCubicDefault = parseNumber(
      raw.shift_client_cubic_default,
      row,
      'shift_client_cubic_default',
      errors
    )
    const crusherCubic = parseNumber(raw.crusher_cubic, row, 'crusher_cubic', errors)
    const clientCubicReported = parseNumber(
      raw.client_cubic_reported,
      row,
      'client_cubic_reported',
      errors
    )
    const stonePrice = parseOptionalNumber(raw.stone_price, row, 'stone_price', errors) ?? null
    const transportPrice = parseNumber(raw.transport_price, row, 'transport_price', errors)
    const clientPrice = parseNumber(raw.client_price, row, 'client_price', errors)
    const discountQty = parseOptionalNumber(raw.discount_qty, row, 'discount_qty', errors) ?? 0
    const crusherReceiptStatus = text(raw.crusher_receipt_status)
    const recipientNameStatusInput = text(raw.recipient_name_status)
    const recipientNameStatus = recipientNameStatusInput || 'مش واضح'

    if (!validCrusherReceiptStatuses.has(crusherReceiptStatus)) {
      errors.push({
        row,
        field: 'crusher_receipt_status',
        message: 'حالة إيصال الكسارة غير مسموحة'
      })
    }
    if (!validRecipientNameStatuses.has(recipientNameStatus)) {
      errors.push({ row, field: 'recipient_name_status', message: 'حالة اسم المستلم غير مسموحة' })
    }

    const crusherReceiptNo = parseOptionalNumber(
      raw.crusher_receipt_no,
      row,
      'crusher_receipt_no',
      errors
    )
    if (crusherReceiptStatus === 'قيمة' && crusherReceiptNo === undefined) {
      errors.push({ row, field: 'crusher_receipt_no', message: 'رقم إيصال الكسارة مطلوب' })
    }
    if (crusherReceiptStatus !== 'قيمة' && text(raw.crusher_receipt_no)) {
      errors.push({ row, field: 'crusher_receipt_no', message: 'اترك رقم الإيصال فارغًا' })
    }

    const recipientName = text(raw.recipient_name)
    if (recipientNameStatus === 'قيمة' && !recipientName) {
      errors.push({ row, field: 'recipient_name', message: 'اسم المستلم مطلوب' })
    }

    const driverId = driverName ? getDriverIdByName(driverName) : undefined
    const crusherId = crusherName ? getCrusherIdByName(crusherName) : undefined
    const clientId = clientName ? getClientIdByName(clientName) : undefined
    if (driverName && driverId === undefined && !missingDrivers.has(driverName)) {
      missingDrivers.set(driverName, row)
    }
    if (crusherName && crusherId === undefined && !missingCrushers.has(crusherName)) {
      missingCrushers.set(crusherName, row)
    }
    if (clientName && clientId === undefined && !missingClients.has(clientName)) {
      missingClients.set(clientName, row)
    }
    if (vehicleNo !== undefined && !vehicleExists(vehicleNo) && !missingVehicles.has(vehicleNo)) {
      missingVehicles.set(vehicleNo, row)
    }

    const shiftStartDate = validateDate(raw.shift_start_date, row, 'shift_start_date', errors)
    const rawShiftEndDate = text(raw.shift_end_date)
    const shiftEndDate = rawShiftEndDate
      ? validateDate(rawShiftEndDate, row, 'shift_end_date', errors)
      : null
    const tripDate = validateDate(raw.trip_date, row, 'trip_date', errors)

    if (
      driverId !== undefined &&
      crusherId !== undefined &&
      clientId !== undefined &&
      vehicleNo !== undefined &&
      shiftCrusherCubicDefault !== undefined &&
      shiftClientCubicDefault !== undefined &&
      crusherCubic !== undefined &&
      clientCubicReported !== undefined &&
      transportPrice !== undefined &&
      clientPrice !== undefined
    ) {
      validRows.push({
        oldShiftNo,
        driverId,
        vehicleNo,
        shiftStartDate,
        shiftEndDate,
        shiftCrusherCubicDefault,
        shiftClientCubicDefault,
        tripDate,
        crusherCubic,
        clientCubicReported,
        discountQty,
        discountReason: text(raw.discount_reason) || null,
        location: text(raw.location) || null,
        crusherId,
        stonePrice,
        crusherReceiptStatus,
        crusherReceiptNo: crusherReceiptStatus === 'قيمة' ? (crusherReceiptNo ?? null) : null,
        clientId,
        transportPrice,
        clientPrice,
        recipientNameStatus,
        recipientName: recipientNameStatus === 'قيمة' ? recipientName || null : null,
        clientReceiptNo: text(raw.client_receipt_no) || null,
        notes: text(raw.notes) || null
      })
    }
  })

  if (missingDrivers.size > 0) {
    errors.push({
      row: Math.min(...missingDrivers.values()),
      field: 'driver_name',
      message: `السائقون غير الموجودين: ${Array.from(missingDrivers.keys()).join('، ')}`
    })
  }
  if (missingCrushers.size > 0) {
    errors.push({
      row: Math.min(...missingCrushers.values()),
      field: 'crusher_name',
      message: `الكسارات غير الموجودة: ${Array.from(missingCrushers.keys()).join('، ')}`
    })
  }
  if (missingClients.size > 0) {
    errors.push({
      row: Math.min(...missingClients.values()),
      field: 'client_name',
      message: `العملاء غير الموجودين: ${Array.from(missingClients.keys()).join('، ')}`
    })
  }
  if (missingVehicles.size > 0) {
    errors.push({
      row: Math.min(...missingVehicles.values()),
      field: 'vehicle_no',
      message: `العربيات غير الموجودة: ${Array.from(missingVehicles.keys()).join('، ')}`
    })
  }
  if (errors.length > 0) return { ok: false, errors }

  try {
    backupDatabase()
    const db = getDb()
    let shiftsCreated = 0
    let tripsCreated = 0
    const transaction = db.transaction(() => {
      const groups = new Map<string, ValidatedRow[]>()
      validRows.forEach((row) => {
        const group = groups.get(row.oldShiftNo) ?? []
        group.push(row)
        groups.set(row.oldShiftNo, group)
      })

      groups.forEach((rows) => {
        const first = rows[0]
        const shiftId = getNextShiftId()
        insertImportedShift({
          id: shiftId,
          vehicleNo: first.vehicleNo,
          driverId: first.driverId,
          crusherCubicDefault: first.shiftCrusherCubicDefault,
          clientCubicDefault: first.shiftClientCubicDefault,
          startDate: first.shiftStartDate,
          endDate: first.shiftEndDate
        })
        shiftsCreated += 1

        rows.forEach((row) => {
          insertTrip({
            id: getNextTripId(),
            shiftId,
            tripDate: row.tripDate,
            crusherCubic: row.crusherCubic,
            clientCubicReported: row.clientCubicReported,
            discountQty: row.discountQty,
            discountReason: row.discountReason,
            location: row.location,
            crusherId: row.crusherId,
            stonePrice: row.stonePrice,
            crusherReceiptStatus: row.crusherReceiptStatus,
            crusherReceiptNo: row.crusherReceiptNo,
            clientId: row.clientId,
            transportPrice: row.transportPrice,
            clientPrice: row.clientPrice,
            recipientNameStatus: row.recipientNameStatus,
            recipientName: row.recipientName,
            clientReceiptNo: row.clientReceiptNo,
            notes: row.notes
          })
          tripsCreated += 1
        })
      })
    })
    transaction()
    return { ok: true, data: { shiftsCreated, tripsCreated } }
  } catch (error) {
    const message = isSqliteError(error)
      ? error.message
      : error instanceof Error
        ? error.message
        : 'خطأ غير معروف'
    return {
      ok: false,
      errors: [{ row: 0, field: 'database', message: `فشل الاستيراد: ${message}` }]
    }
  }
}
