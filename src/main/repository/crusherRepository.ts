import { getDb } from '../db'

export interface CrusherRow {
  id: number
  name: string
  initialPrice: number | null
}

export function insertCrusher(name: string, initialPrice: number | null): number {
  const db = getDb()
  const stmt = db.prepare('INSERT INTO Crusher (name, initial_price) VALUES (?, ?)')
  const result = stmt.run(name, initialPrice)
  return result.lastInsertRowid as number
}

export function listCrushers(): CrusherRow[] {
  const db = getDb()
  return db
    .prepare('SELECT id, name, initial_price as initialPrice FROM Crusher ORDER BY name')
    .all() as CrusherRow[]
}

export function getCrusherIdByName(name: string): number | undefined {
  const db = getDb()
  const row = db.prepare('SELECT id FROM Crusher WHERE name = ?').get(name) as
    { id: number } | undefined
  return row?.id
}

export function updateCrusher(id: number, name: string, initialPrice: number | null): void {
  const db = getDb()
  db.prepare('UPDATE Crusher SET name = ?, initial_price = ? WHERE id = ?').run(
    name,
    initialPrice,
    id
  )
}

export function deleteCrusher(id: number): void {
  const db = getDb()
  db.prepare('DELETE FROM Crusher WHERE id = ?').run(id)
}
