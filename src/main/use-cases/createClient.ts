import {
  insertClient,
  listClients as listClientsInDb,
  getClientById,
  updateClient as updateClientInDb,
  deleteClient as deleteClientInDb,
  ClientStorageRow
} from '../repository/clientRepository'
import { fromMinorUnits, toMinorUnits } from '../accounting'
import { validationMessages } from '../validation'

type UseCaseResult<T> =
  { ok: true; data: T } | { ok: false; errors: { field: string; message: string }[] }

interface SqliteError extends Error {
  code: string
}

interface ClientRow {
  id: number
  name: string
  initialPrice: number | null
  location: string | null
  openingBalance: number
  openingBalanceDate: string | null
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
  if (input.initialPrice !== undefined && input.initialPrice <= 0) {
    errors.push({ field: 'initialPrice', message: validationMessages.positivePrice })
  }
  if (input.initialPrice !== undefined && toMinorUnits(input.initialPrice) === null) {
    errors.push({ field: 'initialPrice', message: validationMessages.moneyDecimals })
  }
  if (input.openingBalance !== undefined && toMinorUnits(input.openingBalance) === null) {
    errors.push({ field: 'openingBalance', message: validationMessages.moneyDecimals })
  }
  return errors
}

function clientRowToPublic(row: ClientStorageRow): ClientRow {
  const { initialPriceMinor, openingBalanceMinor, ...rest } = row
  return {
    ...rest,
    initialPrice: initialPriceMinor === null ? null : fromMinorUnits(initialPriceMinor),
    openingBalance: fromMinorUnits(openingBalanceMinor)
  }
}

export function createClient(input: ClientInput): UseCaseResult<ClientRow> {
  const errors = validateClientInput(input)
  if (errors.length > 0) return { ok: false, errors }

  const name = input.name.trim()
  const initialPriceMinor =
    input.initialPrice === undefined ? null : toMinorUnits(input.initialPrice)
  const openingBalanceMinor = toMinorUnits(input.openingBalance ?? 0)
  if (openingBalanceMinor === null) {
    return {
      ok: false,
      errors: [{ field: 'openingBalance', message: validationMessages.moneyDecimals }]
    }
  }
  const location = input.location?.trim() || null
  const openingBalanceDate = input.openingBalanceDate?.trim() || null

  try {
    const id = insertClient(
      name,
      initialPriceMinor,
      location,
      openingBalanceMinor,
      openingBalanceDate
    )
    return {
      ok: true,
      data: {
        id,
        name,
        initialPrice: initialPriceMinor === null ? null : fromMinorUnits(initialPriceMinor),
        location,
        openingBalance: fromMinorUnits(openingBalanceMinor),
        openingBalanceDate
      }
    }
  } catch (err: unknown) {
    if (isSqliteError(err) && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return { ok: false, errors: [{ field: 'name', message: 'العميل ده موجود بالفعل' }] }
    }
    throw err
  }
}

export function listClients(): UseCaseResult<ClientRow[]> {
  return { ok: true, data: listClientsInDb().map(clientRowToPublic) }
}

export function updateClient(input: ClientInput & { id: number }): UseCaseResult<ClientRow> {
  const errors = validateClientInput(input)
  if (errors.length > 0) return { ok: false, errors }

  const existing = getClientById(input.id)
  const name = input.name.trim()
  const initialPriceMinor =
    input.initialPrice === undefined
      ? (existing?.initialPriceMinor ?? null)
      : toMinorUnits(input.initialPrice)
  const location =
    input.location !== undefined ? input.location?.trim() || null : (existing?.location ?? null)
  const openingBalanceMinor =
    input.openingBalance === undefined
      ? (existing?.openingBalanceMinor ?? 0)
      : toMinorUnits(input.openingBalance)
  const openingBalanceDate =
    input.openingBalanceDate !== undefined
      ? input.openingBalanceDate?.trim() || null
      : (existing?.openingBalanceDate ?? null)
  if (openingBalanceMinor === null) {
    return { ok: false, errors: [{ field: 'openingBalance', message: 'المبلغ غير صالح' }] }
  }

  try {
    updateClientInDb(
      input.id,
      name,
      initialPriceMinor,
      location,
      openingBalanceMinor,
      openingBalanceDate
    )
    return {
      ok: true,
      data: {
        id: input.id,
        name,
        initialPrice: initialPriceMinor === null ? null : fromMinorUnits(initialPriceMinor),
        location,
        openingBalance: fromMinorUnits(openingBalanceMinor),
        openingBalanceDate
      }
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
