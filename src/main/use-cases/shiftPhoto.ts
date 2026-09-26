import { deletePhoto, readPhotoAsDataUri, savePhoto } from '../photoStorage'
import { getShiftById, updateShiftClosingPhotoPath } from '../repository/shiftRepository'

type UseCaseResult<T> =
  { ok: true; data: T } | { ok: false; errors: { field: string; message: string }[] }

export function saveShiftPhoto(input: {
  shiftId: string
  imageBase64: string
}): UseCaseResult<{ path: string }> {
  if (!input.shiftId?.trim()) {
    return { ok: false, errors: [{ field: 'shiftId', message: 'الوردية مطلوبة' }] }
  }
  if (!input.imageBase64?.trim()) {
    return { ok: false, errors: [{ field: 'imageBase64', message: 'الصورة مطلوبة' }] }
  }
  const shift = getShiftById(input.shiftId)
  if (!shift) {
    return { ok: false, errors: [{ field: 'shiftId', message: 'الوردية دي مش موجودة' }] }
  }
  if (shift.status === 'منتهية') {
    return { ok: false, errors: [{ field: 'shiftId', message: 'الوردية دي مقفولة بالفعل' }] }
  }

  const path = savePhoto('shift', input.shiftId, input.imageBase64)
  updateShiftClosingPhotoPath(input.shiftId, path)
  return { ok: true, data: { path } }
}

export function deleteShiftPhoto(input: { shiftId: string }): UseCaseResult<{ shiftId: string }> {
  if (!input.shiftId?.trim()) {
    return { ok: false, errors: [{ field: 'shiftId', message: 'الوردية مطلوبة' }] }
  }
  const shift = getShiftById(input.shiftId)
  if (!shift) {
    return { ok: false, errors: [{ field: 'shiftId', message: 'الوردية دي مش موجودة' }] }
  }
  if (shift.status === 'منتهية') {
    return {
      ok: false,
      errors: [{ field: 'shiftId', message: 'مينفعش تمسح ورقة تقفيل وردية مقفولة' }]
    }
  }
  deletePhoto('shift', input.shiftId)
  updateShiftClosingPhotoPath(input.shiftId, null)
  return { ok: true, data: { shiftId: input.shiftId } }
}

export function getShiftPhoto(input: {
  photoPath: string
}): UseCaseResult<{ dataUri: string | null }> {
  if (!input.photoPath?.trim()) {
    return { ok: true, data: { dataUri: null } }
  }
  return { ok: true, data: { dataUri: readPhotoAsDataUri(input.photoPath) } }
}
