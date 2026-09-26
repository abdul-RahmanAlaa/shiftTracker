import {
  insertContractor,
  listContractors as listContractorsInDb,
  updateContractor as updateContractorInDb,
  deleteContractor as deleteContractorInDb,
  ContractorRow
} from '../repository/contractorRepository'

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

interface ContractorInput {
  name: string
  phone?: string
}

function normalizeInput(input: ContractorInput): { name: string; phone: string | null } | null {
  const name = input.name?.trim()
  if (!name) return null
  return { name, phone: input.phone?.trim() || null }
}

export function createContractor(input: ContractorInput): UseCaseResult<ContractorRow> {
  const values = normalizeInput(input)
  if (!values) {
    return { ok: false, errors: [{ field: 'name', message: 'اسم المقاول مطلوب' }] }
  }

  try {
    const id = insertContractor(values.name, values.phone)
    return { ok: true, data: { id, ...values } }
  } catch (err: unknown) {
    if (isSqliteError(err) && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return { ok: false, errors: [{ field: 'name', message: 'مقاول النقل ده موجود بالفعل' }] }
    }
    throw err
  }
}

export function listContractors(): UseCaseResult<ContractorRow[]> {
  return { ok: true, data: listContractorsInDb() }
}

export function updateContractor(
  input: ContractorInput & { id: number }
): UseCaseResult<ContractorRow> {
  const values = normalizeInput(input)
  if (!values) {
    return { ok: false, errors: [{ field: 'name', message: 'اسم المقاول مطلوب' }] }
  }

  try {
    updateContractorInDb(input.id, values.name, values.phone)
    return { ok: true, data: { id: input.id, ...values } }
  } catch (err: unknown) {
    if (isSqliteError(err) && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return { ok: false, errors: [{ field: 'name', message: 'مقاول النقل ده موجود بالفعل' }] }
    }
    throw err
  }
}

export function deleteContractor(input: { id: number }): UseCaseResult<{ id: number }> {
  try {
    deleteContractorInDb(input.id)
    return { ok: true, data: { id: input.id } }
  } catch (err: unknown) {
    if (isSqliteError(err) && err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      return {
        ok: false,
        errors: [{ field: 'id', message: 'مقاول النقل ده مستخدم في بيانات تانية، مينفعش يتمسح' }]
      }
    }
    throw err
  }
}
