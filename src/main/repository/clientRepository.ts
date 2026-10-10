import { getDb } from '../db'

export interface ClientStorageRow {
  id: number
  name: string
  initialPriceMinor: number | null
  location: string | null
  openingBalanceMinor: number
  openingBalanceDate: string | null
}

export function insertClient(
  name: string,
  initialPriceMinor: number | null,
  location: string | null,
  openingBalanceMinor: number,
  openingBalanceDate: string | null
): number {
  const db = getDb()
  const stmt = db.prepare(
    'INSERT INTO Client (name, initial_price, location, opening_balance, opening_balance_date) VALUES (?, ?, ?, ?, ?)'
  )
  const result = stmt.run(
    name,
    initialPriceMinor,
    location,
    openingBalanceMinor,
    openingBalanceDate
  )
  return result.lastInsertRowid as number
}

export function listClients(): ClientStorageRow[] {
  const db = getDb()
  return db
    .prepare(
      `SELECT id, name, initial_price as initialPriceMinor, location,
              opening_balance as openingBalanceMinor, opening_balance_date as openingBalanceDate
       FROM Client ORDER BY name`
    )
    .all() as ClientStorageRow[]
}

export function getClientById(id: number): ClientStorageRow | undefined {
  const db = getDb()
  return db
    .prepare(
      `SELECT id, name, initial_price as initialPriceMinor, location,
              opening_balance as openingBalanceMinor, opening_balance_date as openingBalanceDate
       FROM Client WHERE id = ?`
    )
    .get(id) as ClientStorageRow | undefined
}

export function getClientIdByName(name: string): number | undefined {
  const db = getDb()
  const row = db.prepare('SELECT id FROM Client WHERE name = ?').get(name) as
    { id: number } | undefined
  return row?.id
}

export function updateClient(
  id: number,
  name: string,
  initialPriceMinor: number | null,
  location: string | null,
  openingBalanceMinor: number,
  openingBalanceDate: string | null
): void {
  const db = getDb()
  db.prepare(
    `UPDATE Client SET name = ?, initial_price = ?, location = ?,
     opening_balance = ?, opening_balance_date = ? WHERE id = ?`
  ).run(name, initialPriceMinor, location, openingBalanceMinor, openingBalanceDate, id)
}

export function deleteClient(id: number): void {
  const db = getDb()
  db.prepare('DELETE FROM Client WHERE id = ?').run(id)
}
