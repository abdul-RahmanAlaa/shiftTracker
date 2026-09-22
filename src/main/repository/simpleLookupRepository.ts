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
