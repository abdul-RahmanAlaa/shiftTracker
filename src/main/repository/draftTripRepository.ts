import type Database from 'better-sqlite3'

export interface DraftTripRow {
  id: number
  vehicle_no: number
  trip_date: string
  time_of_day: 'MORNING' | 'EVENING' | null
  crusher_id: number | null
  client_id: number | null
  cubic: number | null
  custody_amount: number | null
  custody_date: string | null
  custody_time: string | null
  receipt_note: string | null
  notes: string | null
  created_at: string
}

export interface DraftTripListRow extends DraftTripRow {
  driver_name: string | null
  shift_id: string | null
  crusher_name: string | null
  client_name: string | null
}

export interface CreateDraftTripInput {
  vehicleNo: number
  tripDate: string
  timeOfDay?: 'MORNING' | 'EVENING'
  crusherId?: number
  clientId?: number
  cubic?: number
  custodyAmount?: number
  custodyDate?: string
  custodyTime?: string
  receiptNote?: string
  notes?: string
}

export interface UpdateDraftTripInput {
  id: number
  tripDate: string
  timeOfDay: 'MORNING' | 'EVENING' | null
  crusherId: number | null
  clientId: number | null
  cubic: number | null
  custodyAmount: number | null
  custodyDate?: string | null
  custodyTime: string | null
  receiptNote: string | null
  notes: string | null
}

export function insertDraftTrip(db: Database.Database, input: CreateDraftTripInput): DraftTripRow {
  const result = db
    .prepare(
      `INSERT INTO DraftTrip (
        vehicle_no, trip_date, time_of_day, crusher_id, client_id, cubic,
        custody_amount, custody_date, custody_time, receipt_note, notes
      ) VALUES (
        @vehicleNo, @tripDate, @timeOfDay, @crusherId, @clientId, @cubic,
        @custodyAmount, @custodyDate, @custodyTime, @receiptNote, @notes
      )`
    )
    .run({
      vehicleNo: input.vehicleNo,
      tripDate: input.tripDate,
      timeOfDay: input.timeOfDay ?? null,
      crusherId: input.crusherId ?? null,
      clientId: input.clientId ?? null,
      cubic: input.cubic ?? null,
      custodyAmount: input.custodyAmount ?? null,
      custodyDate: input.custodyDate ?? null,
      custodyTime: input.custodyTime ?? null,
      receiptNote: input.receiptNote ?? null,
      notes: input.notes ?? null
    })
  const row = getDraftTripById(db, Number(result.lastInsertRowid))
  if (!row) throw new Error('Inserted draft trip could not be read back')
  return row
}

export function updateDraftTrip(
  db: Database.Database,
  input: UpdateDraftTripInput
): DraftTripRow | null {
  const existing = getDraftTripById(db, input.id)
  if (!existing) return null
  db.prepare(
    `UPDATE DraftTrip SET
      trip_date = @tripDate,
      time_of_day = @timeOfDay,
      crusher_id = @crusherId,
      client_id = @clientId,
      cubic = @cubic,
      custody_amount = @custodyAmount,
      custody_date = @custodyDate,
      custody_time = @custodyTime,
      receipt_note = @receiptNote,
      notes = @notes
    WHERE id = @id`
  ).run({
    ...input,
    custodyDate: input.custodyDate === undefined ? existing.custody_date : input.custodyDate
  })
  return getDraftTripById(db, input.id)
}

export function deleteDraftTrip(db: Database.Database, id: number): boolean {
  return db.prepare('DELETE FROM DraftTrip WHERE id = ?').run(id).changes > 0
}

export function getDraftTripById(db: Database.Database, id: number): DraftTripRow | null {
  return (
    (db
      .prepare(
        `SELECT
          id,
          vehicle_no,
          trip_date,
          time_of_day,
          crusher_id,
          client_id,
          cubic,
          custody_amount,
          custody_date,
          custody_time,
          receipt_note,
          notes,
          created_at
        FROM DraftTrip
        WHERE id = ?`
      )
      .get(id) as DraftTripRow | undefined) ?? null
  )
}

export function listDraftTrips(db: Database.Database): DraftTripListRow[] {
  return db
    .prepare(
      `SELECT
        DraftTrip.id,
        DraftTrip.vehicle_no,
        DraftTrip.trip_date,
        DraftTrip.time_of_day,
        DraftTrip.crusher_id,
        DraftTrip.client_id,
        DraftTrip.cubic,
        DraftTrip.custody_amount,
        DraftTrip.custody_date,
        DraftTrip.custody_time,
        DraftTrip.receipt_note,
        DraftTrip.notes,
        DraftTrip.created_at,
        Driver.name AS driver_name,
        Shift.id AS shift_id,
        Crusher.name AS crusher_name,
        Client.name AS client_name
      FROM DraftTrip
      LEFT JOIN Shift
        ON Shift.vehicle_no = DraftTrip.vehicle_no
        AND Shift.status = 'OPEN'
      LEFT JOIN Driver ON Driver.id = Shift.driver_id
      LEFT JOIN Crusher ON Crusher.id = DraftTrip.crusher_id
      LEFT JOIN Client ON Client.id = DraftTrip.client_id
      ORDER BY DraftTrip.created_at ASC`
    )
    .all() as DraftTripListRow[]
}
