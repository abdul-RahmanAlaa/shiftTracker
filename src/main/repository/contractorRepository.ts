import { getDb } from '../db'

export interface ContractorStorageRow {
  id: number
  name: string
  phone: string | null
  openingBalanceMinor: number
  openingBalanceDate: string | null
}

export function insertContractor(
  name: string,
  phone: string | null,
  openingBalance: number,
  openingBalanceDate: string | null
): number {
  const db = getDb()
  const result = db
    .prepare(
      'INSERT INTO TransportContractor (name, phone, opening_balance, opening_balance_date) VALUES (?, ?, ?, ?)'
    )
    .run(name, phone, openingBalance, openingBalanceDate)
  return result.lastInsertRowid as number
}

export function listContractors(): ContractorStorageRow[] {
  const db = getDb()
  return db
    .prepare(
      `SELECT id, name, phone,       opening_balance as openingBalanceMinor,
              opening_balance_date as openingBalanceDate
       FROM TransportContractor ORDER BY name`
    )
    .all() as ContractorStorageRow[]
}

export function getContractorById(id: number): ContractorStorageRow | undefined {
  const db = getDb()
  return db
    .prepare(
      `SELECT id, name, phone,       opening_balance as openingBalanceMinor,
              opening_balance_date as openingBalanceDate
       FROM TransportContractor WHERE id = ?`
    )
    .get(id) as ContractorStorageRow | undefined
}

export function updateContractor(
  id: number,
  name: string,
  phone: string | null,
  openingBalance: number,
  openingBalanceDate: string | null
): void {
  const db = getDb()
  db.prepare(
    `UPDATE TransportContractor SET name = ?, phone = ?,
     opening_balance = ?, opening_balance_date = ? WHERE id = ?`
  ).run(name, phone, openingBalance, openingBalanceDate, id)
}

export function deleteContractor(id: number): void {
  const db = getDb()
  db.prepare('DELETE FROM TransportContractor WHERE id = ?').run(id)
}
