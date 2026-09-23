import { getDb } from '../db'

export function getShiftContractorId(shiftId: string): number | undefined {
  const db = getDb()
  const row = db
    .prepare(
      `SELECT v.contractor_id as contractorId
       FROM Shift s JOIN Vehicle v ON v.vehicle_no = s.vehicle_no
       WHERE s.id = ?`
    )
    .get(shiftId) as { contractorId: number } | undefined
  return row?.contractorId
}

interface InsertLedgerInput {
  entryDate: string
  driverId: number | null
  movementType: string
  amount: number
  shiftId: string | null
  contractorId: number
  notes: string | null
}

export function insertLedger(input: InsertLedgerInput): number {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT INTO Ledger (entry_date, driver_id, movement_type, amount, shift_id, contractor_id, notes)
    VALUES (@entryDate, @driverId, @movementType, @amount, @shiftId, @contractorId, @notes)
  `)
  const result = stmt.run(input)
  return result.lastInsertRowid as number
}

export interface LedgerRow {
  id: number
  entryDate: string
  driverId: number | null
  movementType: string
  amount: number
  shiftId: string | null
  contractorId: number
  notes: string | null
}

export function listLedger(): LedgerRow[] {
  const db = getDb()
  return db
    .prepare(
      `
      SELECT id, entry_date as entryDate, driver_id as driverId, movement_type as movementType,
             amount, shift_id as shiftId, contractor_id as contractorId, notes
      FROM Ledger
      ORDER BY entry_date DESC, id DESC
    `
    )
    .all() as LedgerRow[]
}
