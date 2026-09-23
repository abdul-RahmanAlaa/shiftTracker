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

export function updateVehicle(vehicleNo: number, trailerNo: number, contractorId: number): void {
  const db = getDb()
  db.prepare('UPDATE Vehicle SET trailer_no = ?, contractor_id = ? WHERE vehicle_no = ?').run(
    trailerNo,
    contractorId,
    vehicleNo
  )
}

export function deleteVehicle(vehicleNo: number): void {
  const db = getDb()
  db.prepare('DELETE FROM Vehicle WHERE vehicle_no = ?').run(vehicleNo)
}
