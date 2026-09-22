import { getShiftById, getShiftStats, closeShiftInDb } from '../repository/shiftRepository'

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
  if (shift.status === 'منتهية') {
    return { ok: false, errors: [{ field: 'shiftId', message: 'الوردية دي مقفولة بالفعل' }] }
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
  return { ok: true, data: { id: input.shiftId } }
}
