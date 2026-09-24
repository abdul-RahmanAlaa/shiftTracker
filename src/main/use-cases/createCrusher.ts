import {
  insertCrusher,
  listCrushers as listCrushersInDb,
  updateCrusher as updateCrusherInDb,
  deleteCrusher as deleteCrusherInDb,
  CrusherRow
} from '../repository/crusherRepository'

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

interface CrusherInput {
  name: string
  initialPrice?: number
}

function validateCrusherInput(input: CrusherInput): { field: string; message: string }[] {
  const errors: { field: string; message: string }[] = []
  if (!input.name?.trim()) errors.push({ field: 'name', message: 'اسم الكسارة مطلوب' })
  if (input.initialPrice !== undefined && input.initialPrice < 0) {
    errors.push({ field: 'initialPrice', message: 'السعر لازم يكون رقم موجب' })
  }
  return errors
}

export function createCrusher(input: CrusherInput): UseCaseResult<CrusherRow> {
  const errors = validateCrusherInput(input)
  if (errors.length > 0) return { ok: false, errors }

  const name = input.name.trim()
  const initialPrice = input.initialPrice ?? null

  try {
    const id = insertCrusher(name, initialPrice)
    return { ok: true, data: { id, name, initialPrice } }
  } catch (err: unknown) {
    if (isSqliteError(err) && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return { ok: false, errors: [{ field: 'name', message: 'الكسارة دي موجودة بالفعل' }] }
    }
    throw err
  }
}

export function listCrushers(): UseCaseResult<CrusherRow[]> {
  return { ok: true, data: listCrushersInDb() }
}

export function updateCrusher(input: CrusherInput & { id: number }): UseCaseResult<CrusherRow> {
  const errors = validateCrusherInput(input)
  if (errors.length > 0) return { ok: false, errors }

  const name = input.name.trim()
  const initialPrice = input.initialPrice ?? null

  try {
    updateCrusherInDb(input.id, name, initialPrice)
    return { ok: true, data: { id: input.id, name, initialPrice } }
  } catch (err: unknown) {
    if (isSqliteError(err) && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return { ok: false, errors: [{ field: 'name', message: 'الكسارة دي موجودة بالفعل' }] }
    }
    throw err
  }
}

export function deleteCrusher(input: { id: number }): UseCaseResult<{ id: number }> {
  try {
    deleteCrusherInDb(input.id)
    return { ok: true, data: { id: input.id } }
  } catch (err: unknown) {
    if (isSqliteError(err) && err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      return {
        ok: false,
        errors: [{ field: 'id', message: 'الكسارة دي مستخدمة في بيانات تانية، مينفعش تتمسح' }]
      }
    }
    throw err
  }
}
