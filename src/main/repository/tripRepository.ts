import { getDb } from '../db'

interface InsertTripInput {
  id: string
  shiftId: string
  tripDate: string
  crusherCubic: number
  clientCubicReported: number
  discountQty: number
  discountReason: string | null
  location: string | null
  crusherId: number
  stonePrice: number
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

interface UpdateTripInput {
  id: string
  tripDate: string
  crusherCubic: number
  clientCubicReported: number
  discountQty: number
  discountReason: string | null
  location: string | null
  crusherId: number
  stonePrice: number
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

export interface TripRow {
  id: string
  shiftId: string
  tripDate: string
  crusherCubic: number
  clientCubicReported: number
  discountQty: number
  discountReason: string | null
  location: string | null
  crusherId: number
  stonePrice: number
  crusherReceiptStatus: string
  crusherReceiptNo: number | null
  clientId: number
  transportPrice: number
  clientPrice: number
  recipientNameStatus: string
  recipientName: string | null
  clientReceiptNo: string | null
  notes: string | null
  receiptPhotoPath: string | null
}

export function getNextTripId(): string {
  const db = getDb()
  const row = db
    .prepare(
      `SELECT id FROM Trip WHERE id LIKE 'TRP-%' ORDER BY CAST(SUBSTR(id, 5) AS INTEGER) DESC LIMIT 1`
    )
    .get() as { id: string } | undefined

  const lastNumber = row ? parseInt(row.id.slice(4), 10) : 0
  return `TRP-${String(lastNumber + 1).padStart(4, '0')}`
}

export function insertTrip(input: InsertTripInput): void {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT INTO Trip (
      id, shift_id, trip_date, crusher_cubic, client_cubic_reported,
      discount_qty, discount_reason, location, crusher_id, stone_price,
      crusher_receipt_status, crusher_receipt_no, client_id, transport_price,
      client_price, recipient_name_status, recipient_name, client_receipt_no, notes
    ) VALUES (
      @id, @shiftId, @tripDate, @crusherCubic, @clientCubicReported,
      @discountQty, @discountReason, @location, @crusherId, @stonePrice,
      @crusherReceiptStatus, @crusherReceiptNo, @clientId, @transportPrice,
      @clientPrice, @recipientNameStatus, @recipientName, @clientReceiptNo, @notes
    )
  `)
  stmt.run(input)
}

export function listTripsByShift(shiftId: string): TripRow[] {
  const db = getDb()
  return db
    .prepare(
      `
      SELECT
        id, shift_id as shiftId, trip_date as tripDate,
        crusher_cubic as crusherCubic, client_cubic_reported as clientCubicReported,
        discount_qty as discountQty, discount_reason as discountReason,
        location, crusher_id as crusherId, stone_price as stonePrice,
        crusher_receipt_status as crusherReceiptStatus, crusher_receipt_no as crusherReceiptNo,
        client_id as clientId, transport_price as transportPrice, client_price as clientPrice,
        recipient_name_status as recipientNameStatus, recipient_name as recipientName,
        client_receipt_no as clientReceiptNo, notes,
        receipt_photo_path as receiptPhotoPath
      FROM Trip
      WHERE shift_id = ?
      ORDER BY trip_date, id
    `
    )
    .all(shiftId) as TripRow[]
}

export function listTripLocations(): string[] {
  const db = getDb()
  const rows = db
    .prepare(`SELECT DISTINCT location FROM Trip WHERE location IS NOT NULL ORDER BY location`)
    .all() as { location: string }[]
  return rows.map((r) => r.location)
}

export function getTripById(id: string): TripRow | undefined {
  const db = getDb()
  return db
    .prepare(
      `
      SELECT
        id, shift_id as shiftId, trip_date as tripDate,
        crusher_cubic as crusherCubic, client_cubic_reported as clientCubicReported,
        discount_qty as discountQty, discount_reason as discountReason,
        location, crusher_id as crusherId, stone_price as stonePrice,
        crusher_receipt_status as crusherReceiptStatus, crusher_receipt_no as crusherReceiptNo,
        client_id as clientId, transport_price as transportPrice, client_price as clientPrice,
        recipient_name_status as recipientNameStatus, recipient_name as recipientName,
        client_receipt_no as clientReceiptNo, notes,
        receipt_photo_path as receiptPhotoPath
      FROM Trip
      WHERE id = ?
    `
    )
    .get(id) as TripRow | undefined
}

export function updateTrip(input: UpdateTripInput): void {
  const db = getDb()
  const stmt = db.prepare(`
    UPDATE Trip SET
      trip_date = @tripDate,
      crusher_cubic = @crusherCubic,
      client_cubic_reported = @clientCubicReported,
      discount_qty = @discountQty,
      discount_reason = @discountReason,
      location = @location,
      crusher_id = @crusherId,
      stone_price = @stonePrice,
      crusher_receipt_status = @crusherReceiptStatus,
      crusher_receipt_no = @crusherReceiptNo,
      client_id = @clientId,
      transport_price = @transportPrice,
      client_price = @clientPrice,
      recipient_name_status = @recipientNameStatus,
      recipient_name = @recipientName,
      client_receipt_no = @clientReceiptNo,
      notes = @notes
    WHERE id = @id
  `)
  stmt.run(input)
}

export function deleteTripById(id: string): void {
  const db = getDb()
  db.prepare('DELETE FROM Trip WHERE id = ?').run(id)
}

export function updateTripPhotoPath(tripId: string, photoPath: string | null): void {
  const db = getDb()
  db.prepare('UPDATE Trip SET receipt_photo_path = ? WHERE id = ?').run(photoPath, tripId)
}
