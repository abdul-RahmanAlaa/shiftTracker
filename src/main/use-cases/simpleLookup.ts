import {
  insertLookup,
  listLookup,
  updateLookup,
  deleteLookup
} from '../repository/simpleLookupRepository'

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

function createSimpleLookupListUseCase(table: string) {
  return function (): UseCaseResult<{ id: number; name: string }[]> {
    return { ok: true, data: listLookup(table) }
  }
}

function updateSimpleLookupUseCase(table: string, entityLabel: string) {
  return function (input: {
    id: number
    name: string
  }): UseCaseResult<{ id: number; name: string }> {
    const name = input.name?.trim()
    if (!name)
      return { ok: false, errors: [{ field: 'name', message: `اسم ${entityLabel} مطلوب` }] }
    try {
      updateLookup(table, input.id, name)
      return { ok: true, data: { id: input.id, name } }
    } catch (err: unknown) {
      if (isSqliteError(err) && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return { ok: false, errors: [{ field: 'name', message: `${entityLabel} ده موجود بالفعل` }] }
      }
      throw err
    }
  }
}

function deleteSimpleLookupUseCase(table: string, entityLabel: string) {
  return function (input: { id: number }): UseCaseResult<{ id: number }> {
    try {
      deleteLookup(table, input.id)
      return { ok: true, data: { id: input.id } }
    } catch (err: unknown) {
      if (isSqliteError(err) && err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
        return {
          ok: false,
          errors: [
            { field: 'id', message: `${entityLabel} ده مستخدم في بيانات تانية، مينفعش يتمسح` }
          ]
        }
      }
      throw err
    }
  }
}

export const createDriver = createSimpleLookupUseCase('Driver', 'السائق')
export const createClient = createSimpleLookupUseCase('Client', 'العميل')
export const createCrusher = createSimpleLookupUseCase('Crusher', 'الكسارة')
export const createContractor = createSimpleLookupUseCase('TransportContractor', 'مقاول النقل')
export const listDrivers = createSimpleLookupListUseCase('Driver')
export const listContractors = createSimpleLookupListUseCase('TransportContractor')
export const updateDriver = updateSimpleLookupUseCase('Driver', 'السائق')
export const deleteDriver = deleteSimpleLookupUseCase('Driver', 'السائق')
export const updateClient = updateSimpleLookupUseCase('Client', 'العميل')
export const deleteClient = deleteSimpleLookupUseCase('Client', 'العميل')
export const updateCrusher = updateSimpleLookupUseCase('Crusher', 'الكسارة')
export const deleteCrusher = deleteSimpleLookupUseCase('Crusher', 'الكسارة')
export const updateContractor = updateSimpleLookupUseCase('TransportContractor', 'مقاول النقل')
export const deleteContractor = deleteSimpleLookupUseCase('TransportContractor', 'مقاول النقل')
export const listClients = createSimpleLookupListUseCase('Client')
export const listCrushers = createSimpleLookupListUseCase('Crusher')
