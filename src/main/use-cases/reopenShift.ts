import { getShiftById, reopenShiftInDb } from '../repository/shiftRepository'

type UseCaseResult<T> =
  { ok: true; data: T } | { ok: false; errors: { field: string; message: string }[] }

export interface ReopenShiftInput {
  shiftId: string
  reason: string
}

export function reopenShift(input: ReopenShiftInput): UseCaseResult<{ id: string }> {
  if (typeof input !== 'object' || input === null) {
    return { ok: false, errors: [{ field: 'shiftId', message: 'رقم الوردية مطلوب' }] }
  }

  const errors: { field: string; message: string }[] = []

  if (typeof input.shiftId !== 'string' || !input.shiftId.trim()) {
    errors.push({ field: 'shiftId', message: 'رقم الوردية مطلوب' })
  }

  if (typeof input.reason !== 'string' || !input.reason.trim()) {
    errors.push({ field: 'reason', message: 'سبب إعادة الفتح مطلوب' })
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  try {
    const shift = getShiftById(input.shiftId)
    if (!shift) {
      return { ok: false, errors: [{ field: 'shiftId', message: 'الوردية دي مش موجودة' }] }
    }

    if (shift.status !== 'CLOSED') {
      return {
        ok: false,
        errors: [{ field: 'shiftId', message: 'الوردية دي مش مقفولة، مينفعش تفتحها من جديد' }]
      }
    }

    reopenShiftInDb(input.shiftId, input.reason.trim(), shift.endDate)

    return { ok: true, data: { id: input.shiftId } }
  } catch (err: unknown) {
    console.error('[reopenShift] Failed to reopen shift:', err)
    return { ok: false, errors: [{ field: 'root', message: 'تعذر إعادة فتح الوردية' }] }
  }
}
