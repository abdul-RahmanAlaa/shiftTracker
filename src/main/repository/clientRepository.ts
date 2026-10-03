import { getDb } from '../db'

export interface ClientRow {
  id: number
  name: string
  initialPrice: number | null
  location: string | null
  openingBalance: number
  openingBalanceDate: string | null
}

export function insertClient(
  name: string,
  initialPrice: number | null,
  location: string | null,
  openingBalance: number,
  openingBalanceDate: string | null
): number {
  const db = getDb()
  const stmt = db.prepare(
    'INSERT INTO Client (name, initial_price, location, opening_balance, opening_balance_date) VALUES (?, ?, ?, ?, ?)'
  )
  const result = stmt.run(name, initialPrice, location, openingBalance, openingBalanceDate)
  return result.lastInsertRowid as number
}

export function listClients(): ClientRow[] {
  const db = getDb()
  return db
    .prepare(
      `SELECT id, name, initial_price as initialPrice, location,
              opening_balance as openingBalance, opening_balance_date as openingBalanceDate
       FROM Client ORDER BY name`
    )
    .all() as ClientRow[]
}

export function getClientById(id: number): ClientRow | undefined {
  const db = getDb()
  return db
    .prepare(
      `SELECT id, name, initial_price as initialPrice, location,
              opening_balance as openingBalance, opening_balance_date as openingBalanceDate
       FROM Client WHERE id = ?`
    )
    .get(id) as ClientRow | undefined
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
  initialPrice: number | null,
  location: string | null,
  openingBalance: number,
  openingBalanceDate: string | null
): void {
  const db = getDb()
  db.prepare(
    `UPDATE Client SET name = ?, initial_price = ?, location = ?,
     opening_balance = ?, opening_balance_date = ? WHERE id = ?`
  ).run(name, initialPrice, location, openingBalance, openingBalanceDate, id)
}

export function deleteClient(id: number): void {
  const db = getDb()
  db.prepare('DELETE FROM Client WHERE id = ?').run(id)
}
