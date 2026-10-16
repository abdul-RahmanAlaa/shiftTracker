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

export interface SuggestedTripPriceInputs {
  clientExists: number
  crusherExists: number
  materialTypeExists: number
  clientInitialPriceMinor: number | null
  crusherInitialPriceMinor: number | null
  stoneTripId: string | null
  stoneTripPriceMinor: number | null
  clientTripId: string | null
  clientTripPriceMinor: number | null
  transportLocationTripId: string | null
  transportLocationTripPriceMinor: number | null
  transportClientTripId: string | null
  transportClientTripPriceMinor: number | null
}

export function getSuggestedTripPriceInputs(input: {
  clientId: number
  crusherId: number
  materialTypeId?: number
  location?: string
}): SuggestedTripPriceInputs {
  const db = getDb()
  return db
    .prepare(
      `
      WITH latest_stone AS (
        SELECT id, stone_price
        FROM Trip
        WHERE @materialTypeId IS NOT NULL
          AND crusher_id = @crusherId
          AND material_type_id = @materialTypeId
        ORDER BY trip_date DESC, CAST(SUBSTR(id, 5) AS INTEGER) DESC
        LIMIT 1
      ),
      latest_client AS (
        SELECT id, client_price
        FROM Trip
        WHERE @materialTypeId IS NOT NULL
          AND client_id = @clientId
          AND material_type_id = @materialTypeId
        ORDER BY trip_date DESC, CAST(SUBSTR(id, 5) AS INTEGER) DESC
        LIMIT 1
      ),
      latest_transport_location AS (
        SELECT id, transport_price
        FROM Trip
        WHERE @location IS NOT NULL
          AND client_id = @clientId
          AND location = @location
        ORDER BY trip_date DESC, CAST(SUBSTR(id, 5) AS INTEGER) DESC
        LIMIT 1
      ),
      latest_transport_client AS (
        SELECT id, transport_price
        FROM Trip
        WHERE client_id = @clientId
        ORDER BY trip_date DESC, CAST(SUBSTR(id, 5) AS INTEGER) DESC
        LIMIT 1
      )
      SELECT
        EXISTS(SELECT 1 FROM Client WHERE id = @clientId) as clientExists,
        EXISTS(SELECT 1 FROM Crusher WHERE id = @crusherId) as crusherExists,
        CASE WHEN @materialTypeId IS NULL THEN 1
          ELSE EXISTS(SELECT 1 FROM MaterialType WHERE id = @materialTypeId) END
          as materialTypeExists,
        (SELECT initial_price FROM Client WHERE id = @clientId) as clientInitialPriceMinor,
        (SELECT initial_price FROM Crusher WHERE id = @crusherId) as crusherInitialPriceMinor,
        latest_stone.id as stoneTripId,
        latest_stone.stone_price as stoneTripPriceMinor,
        latest_client.id as clientTripId,
        latest_client.client_price as clientTripPriceMinor,
        latest_transport_location.id as transportLocationTripId,
        latest_transport_location.transport_price as transportLocationTripPriceMinor,
        latest_transport_client.id as transportClientTripId,
        latest_transport_client.transport_price as transportClientTripPriceMinor
      FROM (SELECT 1) AS seed
      LEFT JOIN latest_stone ON 1 = 1
      LEFT JOIN latest_client ON 1 = 1
      LEFT JOIN latest_transport_location ON 1 = 1
      LEFT JOIN latest_transport_client ON 1 = 1
    `
    )
    .get({
      clientId: input.clientId,
      crusherId: input.crusherId,
      materialTypeId: input.materialTypeId ?? null,
      location: input.location ?? null
    }) as SuggestedTripPriceInputs
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
    .prepare(
      `SELECT DISTINCT location FROM Trip WHERE location IS NOT NULL AND TRIM(location) <> '' ORDER BY location`
    )
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
