import { getDb } from '../db'

export function insertVehicle(
  vehicleNo: number,
  trailerNo: number,
  contractorId: number,
  defaultCubic: number | null,
  ownerName: string | null
): void {
  const db = getDb()
  const stmt = db.prepare(
    'INSERT INTO Vehicle (vehicle_no, trailer_no, contractor_id, default_cubic, owner_name) VALUES (?, ?, ?, ?, ?)'
  )
  stmt.run(vehicleNo, trailerNo, contractorId, defaultCubic, ownerName)
}

export function updateVehicle(
  vehicleNo: number,
  trailerNo: number,
  contractorId: number,
  defaultCubic: number | null,
  ownerName: string | null
): void {
  const db = getDb()
  db.prepare(
    'UPDATE Vehicle SET trailer_no = ?, contractor_id = ?, default_cubic = ?, owner_name = ? WHERE vehicle_no = ?'
  ).run(trailerNo, contractorId, defaultCubic, ownerName, vehicleNo)
}

export function deleteVehicle(vehicleNo: number): void {
  const db = getDb()
  db.prepare('DELETE FROM Vehicle WHERE vehicle_no = ?').run(vehicleNo)
}

export function vehicleExists(vehicleNo: number): boolean {
  const db = getDb()
  const row = db.prepare('SELECT 1 as found FROM Vehicle WHERE vehicle_no = ?').get(vehicleNo) as
    { found: number } | undefined
  return row !== undefined
}
