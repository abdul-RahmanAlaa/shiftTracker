import {
  insertClient,
  listClients as listClientsInDb,
  getClientById,
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
  location?: string
  openingBalance?: number
  openingBalanceDate?: string
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
  const location = input.location?.trim() || null
  const openingBalance = input.openingBalance ?? 0
  const openingBalanceDate = input.openingBalanceDate?.trim() || null

  try {
    const id = insertClient(name, initialPrice, location, openingBalance, openingBalanceDate)
    return {
      ok: true,
      data: { id, name, initialPrice, location, openingBalance, openingBalanceDate }
    }
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

  const existing = getClientById(input.id)
  const name = input.name.trim()
  const initialPrice = input.initialPrice ?? existing?.initialPrice ?? null
  const location =
    input.location !== undefined ? input.location?.trim() || null : (existing?.location ?? null)
  const openingBalance = input.openingBalance ?? existing?.openingBalance ?? 0
  const openingBalanceDate =
    input.openingBalanceDate !== undefined
      ? input.openingBalanceDate?.trim() || null
      : (existing?.openingBalanceDate ?? null)

  try {
    updateClientInDb(input.id, name, initialPrice, location, openingBalance, openingBalanceDate)
    return {
      ok: true,
      data: { id: input.id, name, initialPrice, location, openingBalance, openingBalanceDate }
    }
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
