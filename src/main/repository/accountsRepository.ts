import { getDb } from '../db'
import { LedgerRow } from './ledgerRepository'
import { ClientAccountingTrip, ContractorAccountingTrip } from '../accounting'

export interface ContractorAccountTotals {
  openingBalanceMinor: number
  trips: ContractorAccountingTrip[]
  settlementsMinor: number[]
}

export function getContractorAccountInputs(
  contractorId: number
): ContractorAccountTotals | undefined {
  const db = getDb()
  const entity = db
    .prepare('SELECT opening_balance as openingBalanceMinor FROM TransportContractor WHERE id = ?')
    .get(contractorId) as { openingBalanceMinor: number } | undefined
  if (!entity) return undefined
  const trips = db
    .prepare(
      `
      SELECT t.id, t.trip_date as date, mt.name as description,
             t.client_cubic_reported as clientCubicReported,
             t.transport_price as transportPriceMinor,
             t.crusher_cubic as crusherCubic,
             t.stone_price as stonePriceMinor,
             t.notes
      FROM Trip t
      JOIN Shift s ON s.id = t.shift_id
      LEFT JOIN MaterialType mt ON mt.id = t.material_type_id
      WHERE s.contractor_id = ?
      ORDER BY t.trip_date, t.id
    `
    )
    .all(contractorId) as ContractorAccountingTrip[]
  const settlements = db
    .prepare('SELECT amount FROM Ledger WHERE contractor_id = ?')
    .all(contractorId) as { amount: number }[]
  return {
    openingBalanceMinor: entity.openingBalanceMinor,
    trips,
    settlementsMinor: settlements.map((row) => row.amount)
  }
}

export function listLedgerByContractor(contractorId: number): LedgerRow[] {
  const db = getDb()
  return db
    .prepare(
      `
      SELECT id, entry_date as entryDate, driver_id as driverId, movement_type as movementType,
             amount as amountMinor, shift_id as shiftId, contractor_id as contractorId, notes
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
             amount as amountMinor, shift_id as shiftId, contractor_id as contractorId, notes
      FROM Ledger
      WHERE driver_id = ?
      ORDER BY entry_date DESC, id DESC
    `
    )
    .all(driverId) as LedgerRow[]
}

export interface ClientPaymentRow {
  id: number
  entryDate: string
  clientId: number
  amountMinor: number
  notes: string | null
}

export function getClientPaymentById(id: number): ClientPaymentRow | undefined {
  const db = getDb()
  return db
    .prepare(
      `
      SELECT id, entry_date as entryDate, client_id as clientId, amount as amountMinor, notes
      FROM ClientPayment
      WHERE id = ?
    `
    )
    .get(id) as ClientPaymentRow | undefined
}

export function insertClientPayment(input: {
  entryDate: string
  clientId: number
  amountMinor: number
  notes: string | null
}): number {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT INTO ClientPayment (entry_date, client_id, amount, notes)
    VALUES (@entryDate, @clientId, @amountMinor, @notes)
  `)
  return stmt.run(input).lastInsertRowid as number
}

export function updateClientPayment(input: {
  id: number
  entryDate: string
  clientId: number
  amountMinor: number
  notes: string | null
}): void {
  const db = getDb()
  db.prepare(
    `
    UPDATE ClientPayment
    SET entry_date = @entryDate,
        client_id = @clientId,
        amount = @amountMinor,
        notes = @notes
    WHERE id = @id
  `
  ).run(input)
}

export function deleteClientPayment(id: number): void {
  const db = getDb()
  db.prepare('DELETE FROM ClientPayment WHERE id = ?').run(id)
}

export function listClientPayments(clientId: number): ClientPaymentRow[] {
  const db = getDb()
  return db
    .prepare(
      `
      SELECT id, entry_date as entryDate, client_id as clientId, amount as amountMinor, notes
      FROM ClientPayment
      WHERE client_id = ?
      ORDER BY entry_date DESC, id DESC
    `
    )
    .all(clientId) as ClientPaymentRow[]
}

export interface ClientAccountInputs {
  openingBalanceMinor: number
  trips: ClientAccountingTrip[]
  paymentsMinor: number[]
}

export function getClientAccountInputs(clientId: number): ClientAccountInputs | undefined {
  const db = getDb()
  const entity = db
    .prepare('SELECT opening_balance as openingBalanceMinor FROM Client WHERE id = ?')
    .get(clientId) as { openingBalanceMinor: number } | undefined
  if (!entity) return undefined
  const trips = db
    .prepare(
      `
      SELECT t.id, t.trip_date as date, mt.name as description,
             t.client_cubic_reported as clientCubicReported,
             t.client_price as clientPriceMinor,
             t.fine_amount as fineAmountMinor,
             t.fine_reason as fineReason,
             t.notes
      FROM Trip t
      LEFT JOIN MaterialType mt ON mt.id = t.material_type_id
      WHERE t.client_id = ?
      ORDER BY t.trip_date, t.id
    `
    )
    .all(clientId) as ClientAccountingTrip[]
  const payments = db
    .prepare('SELECT amount FROM ClientPayment WHERE client_id = ?')
    .all(clientId) as { amount: number }[]
  return {
    openingBalanceMinor: entity.openingBalanceMinor,
    trips,
    paymentsMinor: payments.map((row) => row.amount)
  }
}
