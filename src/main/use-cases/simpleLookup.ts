import { insertLookup, listLookup } from '../repository/simpleLookupRepository'

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

function createSimpleLookupUseCase(table: string, entityLabel: string) {
  return function (input: { name: string }): UseCaseResult<{ id: number; name: string }> {
    const name = input.name?.trim()

    if (!name) {
      return { ok: false, errors: [{ field: 'name', message: `اسم ${entityLabel} مطلوب` }] }
    }

    try {
      const id = insertLookup(table, name)
      return { ok: true, data: { id, name } }
    } catch (err: unknown) {
      if (isSqliteError(err) && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return { ok: false, errors: [{ field: 'name', message: `${entityLabel} ده موجود بالفعل` }] }
      }
      throw err
    }
  }
}

export const createDriver = createSimpleLookupUseCase('Driver', 'السائق')
export const createClient = createSimpleLookupUseCase('Client', 'العميل')
export const createCrusher = createSimpleLookupUseCase('Crusher', 'الكسارة')
export const createContractor = createSimpleLookupUseCase('TransportContractor', 'مقاول النقل')

function createSimpleLookupListUseCase(table: string) {
  return function (): UseCaseResult<{ id: number; name: string }[]> {
    return { ok: true, data: listLookup(table) }
  }
}

export const listDrivers = createSimpleLookupListUseCase('Driver')
export const listContractors = createSimpleLookupListUseCase('TransportContractor')
