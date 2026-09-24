import { getDb } from '../db'

export interface ClientRow {
  id: number
  name: string
  initialPrice: number | null
}

export function insertClient(name: string, initialPrice: number | null): number {
  const db = getDb()
  const stmt = db.prepare('INSERT INTO Client (name, initial_price) VALUES (?, ?)')
  const result = stmt.run(name, initialPrice)
  return result.lastInsertRowid as number
}

export function listClients(): ClientRow[] {
  const db = getDb()
  return db
    .prepare('SELECT id, name, initial_price as initialPrice FROM Client ORDER BY name')
    .all() as ClientRow[]
}

export function getClientIdByName(name: string): number | undefined {
  const db = getDb()
  const row = db.prepare('SELECT id FROM Client WHERE name = ?').get(name) as
    { id: number } | undefined
  return row?.id
}

export function updateClient(id: number, name: string, initialPrice: number | null): void {
  const db = getDb()
  db.prepare('UPDATE Client SET name = ?, initial_price = ? WHERE id = ?').run(
    name,
    initialPrice,
    id
  )
}

export function deleteClient(id: number): void {
  const db = getDb()
  db.prepare('DELETE FROM Client WHERE id = ?').run(id)
}
