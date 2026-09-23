import { getDb } from '../db'
import { LedgerRow } from './ledgerRepository'

export interface ContractorAccountTotals {
  transportTotal: number
  ledgerTotal: number
  balance: number
}

export function getContractorAccountTotals(contractorId: number): ContractorAccountTotals {
  const db = getDb()
  const row = db
    .prepare(
      `
      SELECT
        (SELECT COALESCE(SUM(t.crusher_cubic * t.transport_price), 0)
         FROM Trip t
         JOIN Shift s ON t.shift_id = s.id
         JOIN Vehicle v ON s.vehicle_no = v.vehicle_no
         WHERE v.contractor_id = @contractorId) as transportTotal,
        (SELECT COALESCE(SUM(amount), 0) FROM Ledger WHERE contractor_id = @contractorId) as ledgerTotal
    `
    )
    .get({ contractorId }) as { transportTotal: number; ledgerTotal: number }

  return {
    transportTotal: row.transportTotal,
    ledgerTotal: row.ledgerTotal,
    balance: row.transportTotal - row.ledgerTotal
  }
}

export function listLedgerByContractor(contractorId: number): LedgerRow[] {
  const db = getDb()
  return db
    .prepare(
      `
      SELECT id, entry_date as entryDate, driver_id as driverId, movement_type as movementType,
             amount, shift_id as shiftId, contractor_id as contractorId, notes
      FROM Ledger
      WHERE contractor_id = ?
      ORDER BY entry_date DESC, id DESC
    `
    )
    .all(contractorId) as LedgerRow[]
}

export function listLedgerByDriver(driverId: number): LedgerRow[] {
  const db = getDb()
  return db
    .prepare(
      `
      SELECT id, entry_date as entryDate, driver_id as driverId, movement_type as movementType,
             amount, shift_id as shiftId, contractor_id as contractorId, notes
      FROM Ledger
      WHERE driver_id = ?
      ORDER BY entry_date DESC, id DESC
    `
    )
    .all(driverId) as LedgerRow[]
}
