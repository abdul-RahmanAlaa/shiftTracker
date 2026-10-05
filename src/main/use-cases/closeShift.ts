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
  reportedTripCount?: number
}

export function closeShift(input: CloseShiftInput): UseCaseResult<{ id: string }> {
  if (typeof input !== 'object' || input === null) {
    return { ok: false, errors: [{ field: 'shiftId', message: 'رقم الوردية مطلوب' }] }
  }

  const errors: { field: string; message: string }[] = []

  if (typeof input.shiftId !== 'string' || !input.shiftId.trim()) {
    errors.push({ field: 'shiftId', message: 'رقم الوردية مطلوب' })
  }
  if (typeof input.endDate !== 'string' || !input.endDate.trim()) {
    errors.push({ field: 'endDate', message: 'تاريخ النهاية مطلوب' })
  }
  if (
    input.reportedTripCount !== undefined &&
    (typeof input.reportedTripCount !== 'number' ||
      !Number.isInteger(input.reportedTripCount) ||
      input.reportedTripCount < 0)
  ) {
    errors.push({
      field: 'reportedTripCount',
      message: 'عدد النقلات لازم يكون عددًا صحيحًا غير سالب'
    })
  }
  if (errors.length > 0) return { ok: false, errors }

  const shift = getShiftById(input.shiftId)
  if (!shift) {
    return { ok: false, errors: [{ field: 'shiftId', message: 'الوردية دي مش موجودة' }] }
  }
  if (shift.status === 'CLOSED') {
    return { ok: false, errors: [{ field: 'shiftId', message: 'الوردية دي مقفولة بالفعل' }] }
  }
  if (input.reportedTripCount !== undefined && shift.status !== 'REOPENED') {
    return {
      ok: false,
      errors: [
        {
          field: 'reportedTripCount',
          message: 'إعادة إدخال عدد النقلات متاحة عند قفل الوردية المعاد فتحها فقط'
        }
      ]
    }
  }
  if (shift.status !== 'OPEN' && shift.status !== 'REOPENED') {
    return {
      ok: false,
      errors: [{ field: 'shiftId', message: 'حالة الوردية غير مسموح بها للقفل' }]
    }
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
  const reportedTripCount = input.reportedTripCount ?? stats?.reported_trip_count ?? null
  if (stats && reportedTripCount !== null && stats.actual_trip_count !== reportedTripCount) {
    return {
      ok: false,
      errors: [
        {
          field: 'tripCount',
          message: `عدد النقلات المُدخل (${stats.actual_trip_count}) مش مطابق للمُبلَّغ به (${reportedTripCount})`
        }
      ]
    }
  }

  closeShiftInDb(input.shiftId, input.endDate, input.reportedTripCount)
  backupDatabase()
  return { ok: true, data: { id: input.shiftId } }
}
