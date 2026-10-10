import { getDb } from '../db'

interface InsertTripInput {
  id: string
  shiftId: string
  tripDate: string
  crusherCubic: number
  clientCubicReported: number
  fineAmountMinor: number
  fineReason: string | null
  location: string | null
  crusherId: number
  stonePriceMinor: number
  crusherReceiptStatus: string
  crusherReceiptNo: number | null
  clientId: number
  transportPriceMinor: number
  clientPriceMinor: number
  recipientNameStatus: string
  recipientName: string | null
  clientReceiptNo: string | null
  notes: string | null
  materialTypeId: number | null
}

interface UpdateTripInput {
  id: string
  tripDate: string
  crusherCubic: number
  clientCubicReported: number
  fineAmountMinor: number
  fineReason: string | null
  location: string | null
  crusherId: number
  stonePriceMinor: number
  crusherReceiptStatus: string
  crusherReceiptNo: number | null
  clientId: number
  transportPriceMinor: number
  clientPriceMinor: number
  recipientNameStatus: string
  recipientName: string | null
  clientReceiptNo: string | null
  notes: string | null
  materialTypeId: number | null
}

export interface TripRow {
  id: string
  shiftId: string
  tripDate: string
  crusherCubic: number
  clientCubicReported: number
  fineAmountMinor: number
  fineReason: string | null
  location: string | null
  crusherId: number
  stonePriceMinor: number
  crusherReceiptStatus: string
  crusherReceiptNo: number | null
  clientId: number
  transportPriceMinor: number
  clientPriceMinor: number
  recipientNameStatus: string
  recipientName: string | null
  clientReceiptNo: string | null
  notes: string | null
  materialTypeId: number | null
}

export interface TripWithContextRow {
  id: string
  shiftId: string
  driverName: string
  vehicleNo: number
  tripDate: string
  location: string | null
  crusherName: string
  crusherCubic: number
  clientName: string
  clientCubicReported: number
  fineAmountMinor: number
  fineReason: string | null
  stonePriceMinor: number
  transportPriceMinor: number
  clientPriceMinor: number
  crusherReceiptStatus: string
  crusherReceiptNo: number | null
  recipientNameStatus: string
  recipientName: string | null
  clientReceiptNo: string | null
  notes: string | null
  materialTypeId: number | null
  materialTypeName: string | null
}

export function getNextTripId(): string {
  const db = getDb()
  const next = db.transaction(() => {
    const row = db.prepare('SELECT next_number FROM TripIdCounter WHERE id = 1').get() as {
      next_number: number
    }
    db.prepare('UPDATE TripIdCounter SET next_number = next_number + 1 WHERE id = 1').run()
    return row.next_number
  })()
  return `TRP-${String(next).padStart(4, '0')}`
}

export function insertTrip(input: InsertTripInput): void {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT INTO Trip (
      id, shift_id, trip_date, crusher_cubic, client_cubic_reported,
      fine_amount, fine_reason, location, crusher_id, stone_price,
      crusher_receipt_status, crusher_receipt_no, client_id, transport_price,
      client_price, recipient_name_status, recipient_name, client_receipt_no, notes,
      material_type_id
    ) VALUES (
      @id, @shiftId, @tripDate, @crusherCubic, @clientCubicReported,
      @fineAmountMinor, @fineReason, @location, @crusherId, @stonePriceMinor,
      @crusherReceiptStatus, @crusherReceiptNo, @clientId, @transportPriceMinor,
      @clientPriceMinor, @recipientNameStatus, @recipientName, @clientReceiptNo, @notes,
      @materialTypeId
    )
  `)
  stmt.run(input)
}

const TRIP_COLUMNS = `
  id, shift_id as shiftId, trip_date as tripDate,
  crusher_cubic as crusherCubic, client_cubic_reported as clientCubicReported,
  fine_amount as fineAmountMinor, fine_reason as fineReason,
  location, crusher_id as crusherId, stone_price as stonePriceMinor,
  crusher_receipt_status as crusherReceiptStatus, crusher_receipt_no as crusherReceiptNo,
  client_id as clientId, transport_price as transportPriceMinor, client_price as clientPriceMinor,
  recipient_name_status as recipientNameStatus, recipient_name as recipientName,
  client_receipt_no as clientReceiptNo, notes, material_type_id as materialTypeId
`

export function listTripsByShift(shiftId: string): TripRow[] {
  const db = getDb()
  return db
    .prepare(`SELECT ${TRIP_COLUMNS} FROM Trip WHERE shift_id = ? ORDER BY trip_date, id`)
    .all(shiftId) as TripRow[]
}

export function listTripLocations(): string[] {
  const db = getDb()
  const rows = db
    .prepare(`SELECT DISTINCT location FROM Trip WHERE location IS NOT NULL ORDER BY location`)
    .all() as { location: string }[]
  return rows.map((r) => r.location)
}

export function listAllTrips(): TripWithContextRow[] {
  const db = getDb()
  return db
    .prepare(
      `
      SELECT
        t.id,
        t.shift_id as shiftId,
        d.name as driverName,
        s.vehicle_no as vehicleNo,
        t.trip_date as tripDate,
        t.location,
        cr.name as crusherName,
        t.crusher_cubic as crusherCubic,
        c.name as clientName,
        t.client_cubic_reported as clientCubicReported,
        t.fine_amount as fineAmountMinor,
        t.fine_reason as fineReason,
        t.stone_price as stonePriceMinor,
        t.transport_price as transportPriceMinor,
        t.client_price as clientPriceMinor,
        t.crusher_receipt_status as crusherReceiptStatus,
        t.crusher_receipt_no as crusherReceiptNo,
        t.recipient_name_status as recipientNameStatus,
        t.recipient_name as recipientName,
        t.client_receipt_no as clientReceiptNo,
        t.notes,
        t.material_type_id as materialTypeId,
        mt.name as materialTypeName
      FROM Trip t
      JOIN Shift s ON s.id = t.shift_id
      JOIN Driver d ON d.id = s.driver_id
      JOIN Crusher cr ON cr.id = t.crusher_id
      JOIN Client c ON c.id = t.client_id
      LEFT JOIN MaterialType mt ON mt.id = t.material_type_id
      ORDER BY t.trip_date ASC, t.id ASC
    `
    )
    .all() as TripWithContextRow[]
}

export function getTripById(id: string): TripRow | undefined {
  const db = getDb()
  return db.prepare(`SELECT ${TRIP_COLUMNS} FROM Trip WHERE id = ?`).get(id) as TripRow | undefined
}

export function updateTrip(input: UpdateTripInput): void {
  const db = getDb()
  const stmt = db.prepare(`
    UPDATE Trip SET
      trip_date = @tripDate,
      crusher_cubic = @crusherCubic,
      client_cubic_reported = @clientCubicReported,
      fine_amount = @fineAmountMinor,
      fine_reason = @fineReason,
      location = @location,
      crusher_id = @crusherId,
      stone_price = @stonePriceMinor,
      crusher_receipt_status = @crusherReceiptStatus,
      crusher_receipt_no = @crusherReceiptNo,
      client_id = @clientId,
      transport_price = @transportPriceMinor,
      client_price = @clientPriceMinor,
      recipient_name_status = @recipientNameStatus,
      recipient_name = @recipientName,
      client_receipt_no = @clientReceiptNo,
      notes = @notes,
      material_type_id = @materialTypeId
    WHERE id = @id
  `)
  stmt.run(input)
}

export function deleteTripById(id: string): void {
  const db = getDb()
  db.prepare('DELETE FROM Trip WHERE id = ?').run(id)
}
