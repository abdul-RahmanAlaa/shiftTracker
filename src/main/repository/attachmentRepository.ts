import { getDb } from '../db'

export type AttachmentEntityType = 'TRIP' | 'SHIFT'
export type AttachmentKind = 'CRUSHER_RECEIPT' | 'CLIENT_RECEIPT' | 'CLOSING_SHEET'

export interface AttachmentRow {
  id: number
  entityType: AttachmentEntityType
  entityId: string
  kind: AttachmentKind
  photoPath: string
  createdAt: string
}

export function listAttachments(
  entityType: AttachmentEntityType,
  entityId: string
): AttachmentRow[] {
  const db = getDb()
  return db
    .prepare(
      `SELECT id, entity_type as entityType, entity_id as entityId, kind, photo_path as photoPath, created_at as createdAt
       FROM Attachment WHERE entity_type = ? AND entity_id = ? ORDER BY created_at`
    )
    .all(entityType, entityId) as AttachmentRow[]
}

export function insertAttachment(input: {
  entityType: AttachmentEntityType
  entityId: string
  kind: AttachmentKind
  photoPath: string
}): number {
  const db = getDb()
  const result = db
    .prepare(
      `INSERT INTO Attachment (entity_type, entity_id, kind, photo_path) VALUES (?, ?, ?, ?)`
    )
    .run(input.entityType, input.entityId, input.kind, input.photoPath)
  return Number(result.lastInsertRowid)
}

export function updateAttachmentPath(id: number, photoPath: string): void {
  const db = getDb()
  db.prepare(`UPDATE Attachment SET photo_path = ? WHERE id = ?`).run(photoPath, id)
}

export function getAttachmentById(id: number): AttachmentRow | undefined {
  const db = getDb()
  return db
    .prepare(
      `SELECT id, entity_type as entityType, entity_id as entityId, kind, photo_path as photoPath, created_at as createdAt
       FROM Attachment WHERE id = ?`
    )
    .get(id) as AttachmentRow | undefined
}

export function deleteAttachment(id: number): void {
  const db = getDb()
  db.prepare(`DELETE FROM Attachment WHERE id = ?`).run(id)
}

export function countAttachments(entityType: AttachmentEntityType, entityId: string): number {
  const db = getDb()
  const row = db
    .prepare(`SELECT COUNT(*) as c FROM Attachment WHERE entity_type = ? AND entity_id = ?`)
    .get(entityType, entityId) as { c: number }
  return row.c
}
