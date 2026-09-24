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

interface VehicleFieldsInput {
  vehicleNo: number
  trailerNo: number
  contractorId: number
  defaultCubic?: number
  ownerName?: string
}

function validateVehicleFields(input: VehicleFieldsInput): { field: string; message: string }[] {
  const errors: { field: string; message: string }[] = []
  if (!input.vehicleNo) errors.push({ field: 'vehicleNo', message: 'رقم السيارة مطلوب' })
  if (!input.contractorId) errors.push({ field: 'contractorId', message: 'مقاول النقل مطلوب' })
  if (!input.trailerNo) errors.push({ field: 'trailerNo', message: 'رقم المقطورة مطلوب' })
  if (input.defaultCubic !== undefined && input.defaultCubic < 0) {
    errors.push({ field: 'defaultCubic', message: 'التكعيب الافتراضي لازم يكون رقم موجب' })
  }
  return errors
}

export function createVehicle(
  input: VehicleFieldsInput
): UseCaseResult<{ vehicleNo: number; defaultCubic: number | null; ownerName: string | null }> {
  const errors = validateVehicleFields(input)
  if (errors.length > 0) return { ok: false, errors }

  const defaultCubic = input.defaultCubic ?? null
  const ownerName = input.ownerName?.trim() || null

  try {
    insertVehicle(input.vehicleNo, input.trailerNo, input.contractorId, defaultCubic, ownerName)
    return { ok: true, data: { vehicleNo: input.vehicleNo, defaultCubic, ownerName } }
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

export function updateVehicle(
  input: VehicleFieldsInput
): UseCaseResult<{ vehicleNo: number; defaultCubic: number | null; ownerName: string | null }> {
  const errors = validateVehicleFields(input)
  if (errors.length > 0) return { ok: false, errors }

  const defaultCubic = input.defaultCubic ?? null
  const ownerName = input.ownerName?.trim() || null

  try {
    updateVehicleInDb(input.vehicleNo, input.trailerNo, input.contractorId, defaultCubic, ownerName)
    return { ok: true, data: { vehicleNo: input.vehicleNo, defaultCubic, ownerName } }
  } catch (err: unknown) {
    if (isSqliteError(err) && err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      return { ok: false, errors: [{ field: 'contractorId', message: 'مقاول النقل ده مش موجود' }] }
    }
    throw err
  }
}

export function deleteVehicle(input: {
  vehicleNo: number
}): UseCaseResult<{ vehicleNo: number; defaultCubic: number | null; ownerName: string | null }> {
  try {
    deleteVehicleInDb(input.vehicleNo)
    return {
      ok: true,
      data: {
        vehicleNo: input.vehicleNo,
        defaultCubic: null,
        ownerName: null
      }
    }
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
