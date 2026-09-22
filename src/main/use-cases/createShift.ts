import { getNextShiftId, insertShift } from '../repository/shiftRepository'

type UseCaseResult<T> =
  { ok: true; data: T } | { ok: false; errors: { field: string; message: string }[] }

interface SqliteError extends Error {
  code: string
}

function isSqliteError(err: unknown): err is SqliteError {
  return (
    err instanceof Error && 'code' in err && typeof (err as { code: unknown }).code === 'string'
  )
}

export interface CreateShiftInput {
  vehicleNo: number
  driverId: number
  crusherCubicDefault: number
  clientCubicDefault: number
  startDate: string
  reportedDestination?: string
  reportedTripCount?: number
  notes?: string
}

export function createShift(input: CreateShiftInput): UseCaseResult<{ id: string }> {
  const errors: { field: string; message: string }[] = []

  if (!input.vehicleNo) errors.push({ field: 'vehicleNo', message: 'رقم السيارة مطلوب' })
  if (!input.driverId) errors.push({ field: 'driverId', message: 'السائق مطلوب' })
  if (!input.crusherCubicDefault)
    errors.push({ field: 'crusherCubicDefault', message: 'تكعيب الكسارة مطلوب' })
  if (!input.clientCubicDefault)
    errors.push({ field: 'clientCubicDefault', message: 'تكعيب العميل مطلوب' })
  if (!input.startDate?.trim()) errors.push({ field: 'startDate', message: 'تاريخ البداية مطلوب' })

  if (errors.length > 0) return { ok: false, errors }

  const id = getNextShiftId()

  try {
    insertShift({
      id,
      vehicleNo: input.vehicleNo,
      driverId: input.driverId,
      crusherCubicDefault: input.crusherCubicDefault,
      clientCubicDefault: input.clientCubicDefault,
      startDate: input.startDate,
      reportedDestination: input.reportedDestination ?? null,
      reportedTripCount: input.reportedTripCount ?? null,
      notes: input.notes ?? null
    })
    return { ok: true, data: { id } }
  } catch (err: unknown) {
    if (isSqliteError(err) && err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      return {
        ok: false,
        errors: [{ field: 'vehicleNo', message: 'السيارة أو السائق مش موجودين' }]
      }
    }
    throw err
  }
}
