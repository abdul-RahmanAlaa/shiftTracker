import { getDb } from '../db'

export function insertVehicle(
  vehicleNo: number,
  trailerNo: number | null,
  contractorId: number
): void {
  const db = getDb()
  const stmt = db.prepare(
    'INSERT INTO Vehicle (vehicle_no, trailer_no, contractor_id) VALUES (?, ?, ?)'
  )
  stmt.run(vehicleNo, trailerNo, contractorId)
}
