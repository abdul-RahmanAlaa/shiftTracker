import {
  insertClient,
  listClients as listClientsInDb,
  updateClient as updateClientInDb,
  deleteClient as deleteClientInDb,
  ClientRow
} from '../repository/clientRepository'

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

interface ClientInput {
  name: string
  initialPrice?: number
}

function validateClientInput(input: ClientInput): { field: string; message: string }[] {
  const errors: { field: string; message: string }[] = []
  if (!input.name?.trim()) errors.push({ field: 'name', message: 'اسم العميل مطلوب' })
  if (input.initialPrice !== undefined && input.initialPrice < 0) {
    errors.push({ field: 'initialPrice', message: 'السعر لازم يكون رقم موجب' })
  }
  return errors
}

export function createClient(input: ClientInput): UseCaseResult<ClientRow> {
  const errors = validateClientInput(input)
  if (errors.length > 0) return { ok: false, errors }

  const name = input.name.trim()
  const initialPrice = input.initialPrice ?? null

  try {
    const id = insertClient(name, initialPrice)
    return { ok: true, data: { id, name, initialPrice } }
  } catch (err: unknown) {
    if (isSqliteError(err) && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return { ok: false, errors: [{ field: 'name', message: 'العميل ده موجود بالفعل' }] }
    }
    throw err
  }
}

export function listClients(): UseCaseResult<ClientRow[]> {
  return { ok: true, data: listClientsInDb() }
}

export function updateClient(input: ClientInput & { id: number }): UseCaseResult<ClientRow> {
  const errors = validateClientInput(input)
  if (errors.length > 0) return { ok: false, errors }

  const name = input.name.trim()
  const initialPrice = input.initialPrice ?? null

  try {
    updateClientInDb(input.id, name, initialPrice)
    return { ok: true, data: { id: input.id, name, initialPrice } }
  } catch (err: unknown) {
    if (isSqliteError(err) && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return { ok: false, errors: [{ field: 'name', message: 'العميل ده موجود بالفعل' }] }
    }
    throw err
  }
}

export function deleteClient(input: { id: number }): UseCaseResult<{ id: number }> {
  try {
    deleteClientInDb(input.id)
    return { ok: true, data: { id: input.id } }
  } catch (err: unknown) {
    if (isSqliteError(err) && err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      return {
        ok: false,
        errors: [{ field: 'id', message: 'العميل ده مستخدم في بيانات تانية، مينفعش يتمسح' }]
      }
    }
    throw err
  }
}
