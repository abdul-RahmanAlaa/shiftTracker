import {
  insertVehicle,
  updateVehicle as updateVehicleInDb,
  deleteVehicle as deleteVehicleInDb
} from '../repository/vehicleRepository'

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

interface CreateVehicleInput {
  vehicleNo: number
  trailerNo?: number
  contractorId: number
}

export function createVehicle(input: CreateVehicleInput): UseCaseResult<{ vehicleNo: number }> {
  const errors: { field: string; message: string }[] = []

  if (!input.vehicleNo) errors.push({ field: 'vehicleNo', message: 'رقم السيارة مطلوب' })
  if (!input.contractorId) errors.push({ field: 'contractorId', message: 'مقاول النقل مطلوب' })

  if (errors.length > 0) return { ok: false, errors }

  try {
    insertVehicle(input.vehicleNo, input.trailerNo ?? null, input.contractorId)
    return { ok: true, data: { vehicleNo: input.vehicleNo } }
  } catch (err: unknown) {
    if (isSqliteError(err) && err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
      return { ok: false, errors: [{ field: 'vehicleNo', message: 'رقم السيارة ده مسجل بالفعل' }] }
    }
    if (isSqliteError(err) && err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      return { ok: false, errors: [{ field: 'contractorId', message: 'مقاول النقل ده مش موجود' }] }
    }
    throw err
  }
}

export function updateVehicle(input: {
  vehicleNo: number
  trailerNo: number
  contractorId: number
}): UseCaseResult<{ vehicleNo: number }> {
  try {
    updateVehicleInDb(input.vehicleNo, input.trailerNo, input.contractorId)
    return { ok: true, data: { vehicleNo: input.vehicleNo } }
  } catch (err: unknown) {
    if (isSqliteError(err) && err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      return { ok: false, errors: [{ field: 'contractorId', message: 'مقاول النقل ده مش موجود' }] }
    }
    throw err
  }
}

export function deleteVehicle(input: { vehicleNo: number }): UseCaseResult<{ vehicleNo: number }> {
  try {
    deleteVehicleInDb(input.vehicleNo)
    return { ok: true, data: { vehicleNo: input.vehicleNo } }
  } catch (err: unknown) {
    if (isSqliteError(err) && err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      return {
        ok: false,
        errors: [{ field: 'vehicleNo', message: 'العربية دي مستخدمة في ورديات، مينفعش تتمسح' }]
      }
    }
    throw err
  }
}
