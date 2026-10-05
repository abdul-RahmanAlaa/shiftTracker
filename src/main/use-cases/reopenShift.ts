import { getDb } from '../db'
import { getShiftById, reopenShiftInDb } from '../repository/shiftRepository'

type UseCaseResult<T> =
  { ok: true; data: T } | { ok: false; errors: { field: string; message: string }[] }

export interface ReopenShiftInput {
  shiftId: string
  reason: string
}

export function reopenShift(input: ReopenShiftInput): UseCaseResult<{ id: string }> {
  const errors: { field: string; message: string }[] = []

  if (!input.shiftId?.trim()) errors.push({ field: 'shiftId', message: 'رقم الوردية مطلوب' })

  const trimmedReason = input.reason?.trim() ?? ''
  if (!trimmedReason) {
    errors.push({ field: 'reason', message: 'سبب إعادة الفتح مطلوب' })
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

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

  const previousEndDate = getDb()
    .prepare('SELECT end_date FROM Shift WHERE id = ?')
    .get(input.shiftId) as { end_date: string | null } | undefined

  try {
    getDb().transaction(() => {
      reopenShiftInDb(input.shiftId, trimmedReason, previousEndDate?.end_date ?? null)
    })()
    return { ok: true, data: { id: input.shiftId } }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'تعذر إعادة فتح الوردية'
    return { ok: false, errors: [{ field: 'root', message }] }
  }
}
