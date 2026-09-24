import { getDb } from '../db'

export interface DriverRow {
  id: number
  name: string
  phone1: string | null
  phone2: string | null
}

export function insertDriver(name: string, phone1: string | null, phone2: string | null): number {
  const db = getDb()
  const stmt = db.prepare('INSERT INTO Driver (name, phone1, phone2) VALUES (?, ?, ?)')
  const result = stmt.run(name, phone1, phone2)
  return result.lastInsertRowid as number
}

export function listDrivers(): DriverRow[] {
  const db = getDb()
  return db
    .prepare('SELECT id, name, phone1, phone2 FROM Driver ORDER BY name')
    .all() as DriverRow[]
}

export function updateDriver(
  id: number,
  name: string,
  phone1: string | null,
  phone2: string | null
): void {
  const db = getDb()
  db.prepare('UPDATE Driver SET name = ?, phone1 = ?, phone2 = ? WHERE id = ?').run(
    name,
    phone1,
    phone2,
    id
  )
}

export function deleteDriver(id: number): void {
  const db = getDb()
  db.prepare('DELETE FROM Driver WHERE id = ?').run(id)
}
