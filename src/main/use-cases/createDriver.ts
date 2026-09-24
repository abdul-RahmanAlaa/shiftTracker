import {
  insertDriver,
  listDrivers as listDriversInDb,
  updateDriver as updateDriverInDb,
  deleteDriver as deleteDriverInDb,
  DriverRow
} from '../repository/driverRepository'

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

interface DriverInput {
  name: string
  phone1?: string
  phone2?: string
}

export function createDriver(input: DriverInput): UseCaseResult<DriverRow> {
  const name = input.name?.trim()
  if (!name) {
    return { ok: false, errors: [{ field: 'name', message: 'اسم السائق مطلوب' }] }
  }
  const phone1 = input.phone1?.trim() || null
  const phone2 = input.phone2?.trim() || null

  try {
    const id = insertDriver(name, phone1, phone2)
    return { ok: true, data: { id, name, phone1, phone2 } }
  } catch (err: unknown) {
    if (isSqliteError(err) && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return { ok: false, errors: [{ field: 'name', message: 'السائق ده موجود بالفعل' }] }
    }
    throw err
  }
}

export function listDrivers(): UseCaseResult<DriverRow[]> {
  return { ok: true, data: listDriversInDb() }
}

export function updateDriver(input: DriverInput & { id: number }): UseCaseResult<DriverRow> {
  const name = input.name?.trim()
  if (!name) {
    return { ok: false, errors: [{ field: 'name', message: 'اسم السائق مطلوب' }] }
  }
  const phone1 = input.phone1?.trim() || null
  const phone2 = input.phone2?.trim() || null

  try {
    updateDriverInDb(input.id, name, phone1, phone2)
    return { ok: true, data: { id: input.id, name, phone1, phone2 } }
  } catch (err: unknown) {
    if (isSqliteError(err) && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return { ok: false, errors: [{ field: 'name', message: 'السائق ده موجود بالفعل' }] }
    }
    throw err
  }
}

export function deleteDriver(input: { id: number }): UseCaseResult<{ id: number }> {
  try {
    deleteDriverInDb(input.id)
    return { ok: true, data: { id: input.id } }
  } catch (err: unknown) {
    if (isSqliteError(err) && err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      return {
        ok: false,
        errors: [{ field: 'id', message: 'السائق ده مستخدم في بيانات تانية، مينفعش يتمسح' }]
      }
    }
    throw err
  }
}
