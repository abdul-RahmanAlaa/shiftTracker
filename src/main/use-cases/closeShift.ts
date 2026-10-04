import { backupDatabase } from '../backup'
import { getShiftById, getShiftStats, closeShiftInDb } from '../repository/shiftRepository'
import { listAttachments } from '../repository/attachmentRepository'
import { listTripsByShift } from '../repository/tripRepository'
import { attachmentFileExists } from '../photoStorage'

type UseCaseResult<T> =
  { ok: true; data: T } | { ok: false; errors: { field: string; message: string }[] }

export interface CloseShiftInput {
  shiftId: string
  endDate: string
}

export function closeShift(input: CloseShiftInput): UseCaseResult<{ id: string }> {
  const errors: { field: string; message: string }[] = []

  if (!input.shiftId?.trim()) errors.push({ field: 'shiftId', message: 'رقم الوردية مطلوب' })
  if (!input.endDate?.trim()) errors.push({ field: 'endDate', message: 'تاريخ النهاية مطلوب' })
  if (errors.length > 0) return { ok: false, errors }

  const shift = getShiftById(input.shiftId)
  if (!shift) {
    return { ok: false, errors: [{ field: 'shiftId', message: 'الوردية دي مش موجودة' }] }
  }
  if (shift.status === 'CLOSED') {
    return { ok: false, errors: [{ field: 'shiftId', message: 'الوردية دي مقفولة بالفعل' }] }
  }
  const closingAttachment = listAttachments('SHIFT', input.shiftId).find(
    (attachment) => attachment.kind === 'CLOSING_SHEET'
  )
  if (!closingAttachment || !attachmentFileExists(closingAttachment.photoPath)) {
    return {
      ok: false,
      errors: [{ field: 'closingAttachment', message: 'لازم ترفع صورة ورقة تقفيل الوردية الأول' }]
    }
  }

  const tripsMissingAttachments = listTripsByShift(input.shiftId)
    .filter((trip) => listAttachments('TRIP', trip.id).length === 0)
    .map((trip) => trip.id)
  if (tripsMissingAttachments.length > 0) {
    return {
      ok: false,
      errors: [
        {
          field: 'tripAttachments',
          message: `كل نقلة لازم يكون لها مستند واحد على الأقل قبل قفل الوردية: ${tripsMissingAttachments.join(', ')}`
        }
      ]
    }
  }

  const stats = getShiftStats(input.shiftId)
  if (stats?.has_count_mismatch) {
    return {
      ok: false,
      errors: [
        {
          field: 'tripCount',
          message: `عدد النقلات المُدخل (${stats.actual_trip_count}) مش مطابق للمُبلَّغ به (${stats.reported_trip_count})`
        }
      ]
    }
  }

  closeShiftInDb(input.shiftId, input.endDate)
  backupDatabase()
  return { ok: true, data: { id: input.shiftId } }
}
