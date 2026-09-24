import { getDb } from '../db'

export interface VehicleRow {
  vehicleNo: number
  trailerNo: number | null
  contractorId: number
  defaultCubic: number | null
  ownerName: string | null
}

export function listVehicles(): VehicleRow[] {
  const db = getDb()
  return db
    .prepare(
      'SELECT vehicle_no as vehicleNo, trailer_no as trailerNo, contractor_id as contractorId, default_cubic as defaultCubic, owner_name as ownerName FROM Vehicle ORDER BY vehicle_no'
    )
    .all() as VehicleRow[]
}

export function listOpenShifts(): { id: string }[] {
  const db = getDb()
  return db.prepare(`SELECT id FROM Shift WHERE status = 'مفتوحة' ORDER BY id`).all() as {
    id: string
  }[]
}
