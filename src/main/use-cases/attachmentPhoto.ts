import {
  insertAttachment,
  updateAttachmentPath,
  deleteAttachment,
  listAttachments,
  getAttachmentById,
  type AttachmentEntityType,
  type AttachmentKind
} from '../repository/attachmentRepository'
import { saveAttachmentPhoto, deleteAttachmentPhotoFile, readPhotoAsDataUri } from '../photoStorage'

type UseCaseResult<T> =
  { ok: true; data: T } | { ok: false; errors: { field: string; message: string }[] }

export function addAttachment(input: {
  entityType: AttachmentEntityType
  entityId: string
  kind: AttachmentKind
  imageBase64: string
}): UseCaseResult<{ id: number; path: string }> {
  if (!input.entityId?.trim()) {
    return { ok: false, errors: [{ field: 'entityId', message: 'العنصر مطلوب' }] }
  }
  if (!input.imageBase64?.trim()) {
    return { ok: false, errors: [{ field: 'imageBase64', message: 'الصورة مطلوبة' }] }
  }
  const id = insertAttachment({ ...input, photoPath: '' })
  const path = saveAttachmentPhoto(id, input.imageBase64)
  updateAttachmentPath(id, path)
  return { ok: true, data: { id, path } }
}

export function removeAttachment(input: { id: number }): UseCaseResult<{ id: number }> {
  const attachment = getAttachmentById(input.id)
  if (!attachment) {
    return { ok: false, errors: [{ field: 'id', message: 'المرفق غير موجود' }] }
  }
  deleteAttachmentPhotoFile(attachment.photoPath)
  deleteAttachment(input.id)
  return { ok: true, data: { id: input.id } }
}

export function listEntityAttachments(input: {
  entityType: AttachmentEntityType
  entityId: string
}): UseCaseResult<ReturnType<typeof listAttachments>> {
  return { ok: true, data: listAttachments(input.entityType, input.entityId) }
}

export function getAttachmentPhoto(input: {
  photoPath: string
}): UseCaseResult<{ dataUri: string | null }> {
  if (!input.photoPath?.trim()) return { ok: true, data: { dataUri: null } }
  return { ok: true, data: { dataUri: readPhotoAsDataUri(input.photoPath) } }
}
