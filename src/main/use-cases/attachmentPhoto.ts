import {
  insertAttachment,
  updateAttachmentPath,
  deleteAttachment,
  listAttachments,
  getAttachmentById,
  type AttachmentEntityType,
  type AttachmentKind
} from '../repository/attachmentRepository'
import { getTripById } from '../repository/tripRepository'
import { getShiftById } from '../repository/shiftRepository'
import { saveAttachmentPhoto, deleteAttachmentPhotoFile, readPhotoAsDataUri } from '../photoStorage'

type UseCaseResult<T> =
  { ok: true; data: T } | { ok: false; errors: { field: string; message: string }[] }

const VALID_KINDS_FOR_ENTITY: Record<AttachmentEntityType, AttachmentKind[]> = {
  TRIP: ['CRUSHER_RECEIPT', 'CLIENT_RECEIPT'],
  SHIFT: ['CLOSING_SHEET']
}

function getEntityShiftStatus(
  entityType: AttachmentEntityType,
  entityId: string
): { exists: boolean; shiftClosed: boolean } {
  if (entityType === 'SHIFT') {
    const shift = getShiftById(entityId)
    return { exists: !!shift, shiftClosed: shift?.status === 'CLOSED' }
  }
  const trip = getTripById(entityId)
  if (!trip) return { exists: false, shiftClosed: false }
  const shift = getShiftById(trip.shiftId)
  return { exists: true, shiftClosed: shift?.status === 'CLOSED' }
}

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
  if (!VALID_KINDS_FOR_ENTITY[input.entityType]?.includes(input.kind)) {
    return { ok: false, errors: [{ field: 'kind', message: 'نوع المرفق ده مش مسموح للعنصر ده' }] }
  }

  const status = getEntityShiftStatus(input.entityType, input.entityId)
  if (!status.exists) {
    return { ok: false, errors: [{ field: 'entityId', message: 'العنصر ده مش موجود' }] }
  }
  if (status.shiftClosed) {
    return {
      ok: false,
      errors: [{ field: 'entityId', message: 'الوردية دي مقفولة، مينفعش تضاف مرفقات ليها' }]
    }
  }

  const id = insertAttachment({ ...input, photoPath: '' })
  try {
    const path = saveAttachmentPhoto(id, input.imageBase64)
    updateAttachmentPath(id, path)
    return { ok: true, data: { id, path } }
  } catch (err: unknown) {
    deleteAttachment(id)
    return {
      ok: false,
      errors: [
        { field: 'imageBase64', message: err instanceof Error ? err.message : 'فشل حفظ الصورة' }
      ]
    }
  }
}

export function removeAttachment(input: { id: number }): UseCaseResult<{ id: number }> {
  const attachment = getAttachmentById(input.id)
  if (!attachment) {
    return { ok: false, errors: [{ field: 'id', message: 'المرفق غير موجود' }] }
  }

  const status = getEntityShiftStatus(attachment.entityType, attachment.entityId)
  if (status.shiftClosed) {
    return {
      ok: false,
      errors: [{ field: 'id', message: 'الوردية دي مقفولة، مينفعش تتمسح مرفقات منها' }]
    }
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
  attachmentId: number
}): UseCaseResult<{ dataUri: string | null }> {
  const attachment = getAttachmentById(input.attachmentId)
  if (!attachment) {
    return { ok: false, errors: [{ field: 'attachmentId', message: 'المرفق غير موجود' }] }
  }
  return { ok: true, data: { dataUri: readPhotoAsDataUri(attachment.photoPath) } }
}
