import { backupDatabase } from '../backup'
import { getDb } from '../db'
import { getShiftById, getShiftStats, closeShiftInDb } from '../repository/shiftRepository'
import { listAttachments } from '../repository/attachmentRepository'
import { attachmentFileExists } from '../photoStorage'
import { dateStringSchema, nonNegativeIntegerSchema, validationMessages } from '../validation'
import { z } from 'zod'
import { UseCaseResult } from '../useCaseUtils'

export interface CloseShiftSuccessData {
  id: string
  backupWarning?: true
}

export type CloseShiftResult = UseCaseResult<CloseShiftSuccessData>

export interface CloseShiftInput {
  shiftId: string
  endDate: string
  reportedTripCount: number
}

const closeShiftSchema = z.object({
  shiftId: z.string({ error: 'رقم الوردية مطلوب' }).trim().min(1, 'رقم الوردية مطلوب'),
  endDate: dateStringSchema(
    validationMessages.shiftEndDateRequired,
    validationMessages.shiftEndDateInvalid
  ),
  reportedTripCount: nonNegativeIntegerSchema('عدد النقلات لازم يكون عددًا صحيحًا غير سالب')
})

export async function closeShift(
  input: CloseShiftInput,
  now = new Date()
): Promise<CloseShiftResult> {
  if (typeof input !== 'object' || input === null) {
    return { ok: false, errors: [{ field: 'shiftId', message: 'رقم الوردية مطلوب' }] }
  }

  const shiftIdResult = closeShiftSchema.shape.shiftId.safeParse(input.shiftId)
  if (!shiftIdResult.success) {
    return {
      ok: false,
      errors: shiftIdResult.error.issues.map((issue) => ({
        field: String(issue.path[0] ?? 'shiftId'),
        message: issue.message
      }))
    }
  }

  const shiftId = shiftIdResult.data
  const shift = getShiftById(shiftId)
  if (!shift) {
    return { ok: false, errors: [{ field: 'shiftId', message: 'الوردية دي مش موجودة' }] }
  }
  if (shift.status === 'CLOSED') {
    return { ok: false, errors: [{ field: 'shiftId', message: 'الوردية دي مقفولة بالفعل' }] }
  }
  if (shift.status !== 'OPEN' && shift.status !== 'REOPENED') {
    return {
      ok: false,
      errors: [{ field: 'shiftId', message: 'حالة الوردية غير مسموح بها للقفل' }]
    }
  }

  const endDateResult = closeShiftSchema.shape.endDate.safeParse(input.endDate)
  if (!endDateResult.success) {
    return {
      ok: false,
      errors: endDateResult.error.issues.map((issue) => ({
        field: String(issue.path[0] ?? 'endDate'),
        message: issue.message
      }))
    }
  }
  const endDate = endDateResult.data
  if (endDate < shift.startDate) {
    return {
      ok: false,
      errors: [{ field: 'endDate', message: 'تاريخ النهاية لا يمكن أن يكون قبل تاريخ البداية' }]
    }
  }

  const reportedTripCountResult = closeShiftSchema.shape.reportedTripCount.safeParse(
    input.reportedTripCount
  )
  if (!reportedTripCountResult.success) {
    return {
      ok: false,
      errors: reportedTripCountResult.error.issues.map((issue) => ({
        field: 'reportedTripCount',
        message: issue.message
      }))
    }
  }

  const reportedTripCount = reportedTripCountResult.data

  const stats = getShiftStats(shiftId)
  if (stats && stats.actual_trip_count !== reportedTripCount) {
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

  const closingAttachment = listAttachments('SHIFT', shiftId).find(
    (attachment) => attachment.kind === 'CLOSING_SHEET'
  )
  if (!closingAttachment || !attachmentFileExists(closingAttachment.photoPath)) {
    return {
      ok: false,
      errors: [{ field: 'closingAttachment', message: 'لازم ترفع صورة ورقة تقفيل الوردية الأول' }]
    }
  }

  const tripsMissingAttachments = (
    getDb()
      .prepare(
        `SELECT t.id FROM Trip t
         WHERE t.shift_id = ?
           AND NOT EXISTS (
             SELECT 1 FROM Attachment a
             WHERE a.entity_type = 'TRIP' AND a.entity_id = t.id
           )
         ORDER BY t.trip_date, t.id`
      )
      .all(shiftId) as { id: string }[]
  ).map((row) => row.id)
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

  closeShiftInDb(shiftId, endDate, reportedTripCount)
  try {
    const backup = await backupDatabase(shiftId, now)
    return backup.ok
      ? { ok: true, data: { id: shiftId } }
      : { ok: true, data: { id: shiftId, backupWarning: true } }
  } catch (error) {
    console.error('Failed to back up after closing shift', error)
    return { ok: true, data: { id: shiftId, backupWarning: true } }
  }
}
