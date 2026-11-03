import type Database from 'better-sqlite3'

export interface OpenShiftCard {
  shift_id: string
  vehicle_no: number
  trailer_no: number
  driver_name: string
  shift_start_date: string
  days_open: number
  trip_count: number
  draft_count: number
  last_custody_amount: number | null
  last_custody_date: string | null
  last_custody_time: string | null
  custody_trips_since: number
}

interface OpenShiftCardRow extends Omit<OpenShiftCard, 'days_open' | 'custody_trips_since'> {}

export function getOpenShiftCards(db: Database.Database): OpenShiftCard[] {
  const rows = db
    .prepare(
      `SELECT
        Shift.id AS shift_id,
        Vehicle.vehicle_no,
        Vehicle.trailer_no,
        Driver.name AS driver_name,
        Shift.start_date AS shift_start_date,
        (SELECT COUNT(*) FROM Trip WHERE Trip.shift_id = Shift.id) AS trip_count,
        (SELECT COUNT(*) FROM DraftTrip WHERE DraftTrip.vehicle_no = Shift.vehicle_no) AS draft_count,
        custody.amount AS last_custody_amount,
        custody.entry_date AS last_custody_date,
        custody.entry_time AS last_custody_time
      FROM Shift
      JOIN Vehicle ON Vehicle.vehicle_no = Shift.vehicle_no
      JOIN Driver ON Driver.id = Shift.driver_id
      LEFT JOIN Ledger custody ON custody.id = (
        SELECT id FROM Ledger
        WHERE movement_type = 'ADVANCE' AND shift_id = Shift.id
        ORDER BY entry_date DESC, entry_time DESC NULLS LAST, id DESC
        LIMIT 1
      )
      WHERE Shift.status = 'OPEN'`
    )
    .all() as OpenShiftCardRow[]

  const tripsSinceCustody = db.prepare(
    'SELECT COUNT(*) AS count FROM Trip WHERE shift_id = ? AND trip_date > ?'
  )

  return rows.map((row) => {
    const custodyTripsSince =
      row.last_custody_date === null
        ? row.trip_count
        : (tripsSinceCustody.get(row.shift_id, row.last_custody_date) as { count: number }).count

    return {
      ...row,
      days_open: Math.floor((Date.now() - Date.parse(row.shift_start_date)) / 86400000),
      custody_trips_since: custodyTripsSince
    }
  })
}
