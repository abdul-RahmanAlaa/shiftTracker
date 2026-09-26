import { getDb } from '../db'

export interface ContractorRow {
  id: number
  name: string
  phone: string | null
}

export function insertContractor(name: string, phone: string | null): number {
  const db = getDb()
  const result = db
    .prepare('INSERT INTO TransportContractor (name, phone) VALUES (?, ?)')
    .run(name, phone)
  return result.lastInsertRowid as number
}

export function listContractors(): ContractorRow[] {
  const db = getDb()
  return db
    .prepare('SELECT id, name, phone FROM TransportContractor ORDER BY name')
    .all() as ContractorRow[]
}

export function updateContractor(id: number, name: string, phone: string | null): void {
  const db = getDb()
  db.prepare('UPDATE TransportContractor SET name = ?, phone = ? WHERE id = ?').run(name, phone, id)
}

export function deleteContractor(id: number): void {
  const db = getDb()
  db.prepare('DELETE FROM TransportContractor WHERE id = ?').run(id)
}
