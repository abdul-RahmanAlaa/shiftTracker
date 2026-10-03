import { getDb } from '../db'

export interface MaterialTypeRow {
id: number
name: string
}

export function insertMaterialType(name: string): number {
const db = getDb()
const result = db.prepare('INSERT INTO MaterialType (name) VALUES (?)').run(name)
return result.lastInsertRowid as number
}

export function listMaterialTypes(): MaterialTypeRow[] {
const db = getDb()
return db.prepare('SELECT id, name FROM MaterialType ORDER BY name').all() as MaterialTypeRow[]
}

export function updateMaterialType(id: number, name: string): void {
const db = getDb()
db.prepare('UPDATE MaterialType SET name = ? WHERE id = ?').run(name, id)
}

export function deleteMaterialType(id: number): void {
const db = getDb()
db.prepare('DELETE FROM MaterialType WHERE id = ?').run(id)
}
