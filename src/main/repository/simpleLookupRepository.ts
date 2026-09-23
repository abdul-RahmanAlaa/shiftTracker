import { getDb } from '../db'

export function insertLookup(table: string, name: string): number {
  const db = getDb()
  const stmt = db.prepare(`INSERT INTO ${table} (name) VALUES (?)`)
  const result = stmt.run(name)
  return result.lastInsertRowid as number
}

export function listLookup(table: string): { id: number; name: string }[] {
  const db = getDb()
  return db.prepare(`SELECT id, name FROM ${table} ORDER BY name`).all() as {
    id: number
    name: string
  }[]
}

export function updateLookup(table: string, id: number, name: string): void {
  const db = getDb()
  db.prepare(`UPDATE ${table} SET name = ? WHERE id = ?`).run(name, id)
}

export function deleteLookup(table: string, id: number): void {
  const db = getDb()
  db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id)
}
