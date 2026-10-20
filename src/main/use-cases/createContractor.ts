import {
  insertContractor,
  listContractors as listContractorsInDb,
  getContractorById,
  updateContractor as updateContractorInDb,
  deleteContractor as deleteContractorInDb,
  ContractorStorageRow
} from '../repository/contractorRepository'
import { fromMinorUnits, toMinorUnits } from '../accounting'
import { validationMessages } from '../validation'
import { UseCaseResult, isSqliteError } from '../useCaseUtils'

interface ContractorInput {
  name: string
  phone?: string
  openingBalance?: number
  openingBalanceDate?: string
}

interface ContractorRow {
  id: number
  name: string
  phone: string | null
  openingBalance: number
  openingBalanceDate: string | null
}

function normalizeInput(input: ContractorInput): {
  name: string
  phone: string | null
  openingBalanceMinor: number
  openingBalanceDate: string | null
} | null {
  const name = input.name?.trim()
  if (!name) return null
  const openingBalanceMinor =
    input.openingBalance === undefined ? 0 : toMinorUnits(input.openingBalance)
  if (openingBalanceMinor === null) return null
  return {
    name,
    phone: input.phone?.trim() || null,
    openingBalanceMinor,
    openingBalanceDate: input.openingBalanceDate?.trim() || null
  }
}

function contractorRowToPublic(row: ContractorStorageRow): ContractorRow {
  const { openingBalanceMinor, ...rest } = row
  return { ...rest, openingBalance: fromMinorUnits(openingBalanceMinor) }
}

export function createContractor(input: ContractorInput): UseCaseResult<ContractorRow> {
  if (input.openingBalance !== undefined && toMinorUnits(input.openingBalance) === null) {
    return {
      ok: false,
      errors: [{ field: 'openingBalance', message: validationMessages.moneyDecimals }]
    }
  }
  const values = normalizeInput(input)
  if (!values) {
    return { ok: false, errors: [{ field: 'name', message: 'اسم المقاول مطلوب' }] }
  }

  try {
    const id = insertContractor(
      values.name,
      values.phone,
      values.openingBalanceMinor,
      values.openingBalanceDate
    )
    return {
      ok: true,
      data: {
        id,
        name: values.name,
        phone: values.phone,
        openingBalance: fromMinorUnits(values.openingBalanceMinor),
        openingBalanceDate: values.openingBalanceDate
      }
    }
  } catch (err: unknown) {
    if (isSqliteError(err) && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return { ok: false, errors: [{ field: 'name', message: 'مقاول النقل ده موجود بالفعل' }] }
    }
    throw err
  }
}

export function listContractors(): UseCaseResult<ContractorRow[]> {
  return { ok: true, data: listContractorsInDb().map(contractorRowToPublic) }
}

export function updateContractor(
  input: ContractorInput & { id: number }
): UseCaseResult<ContractorRow> {
  if (input.openingBalance !== undefined && toMinorUnits(input.openingBalance) === null) {
    return {
      ok: false,
      errors: [{ field: 'openingBalance', message: validationMessages.moneyDecimals }]
    }
  }
  const existing = getContractorById(input.id)
  const values = normalizeInput({
    name: input.name,
    phone: input.phone !== undefined ? input.phone : (existing?.phone ?? undefined),
    openingBalance:
      input.openingBalance !== undefined
        ? input.openingBalance
        : existing
          ? fromMinorUnits(existing.openingBalanceMinor)
          : 0,
    openingBalanceDate:
      input.openingBalanceDate !== undefined
        ? input.openingBalanceDate
        : (existing?.openingBalanceDate ?? undefined)
  })

  if (!values) {
    return { ok: false, errors: [{ field: 'name', message: 'اسم المقاول مطلوب' }] }
  }

  try {
    updateContractorInDb(
      input.id,
      values.name,
      values.phone,
      values.openingBalanceMinor,
      values.openingBalanceDate
    )
    return {
      ok: true,
      data: {
        id: input.id,
        name: values.name,
        phone: values.phone,
        openingBalance: fromMinorUnits(values.openingBalanceMinor),
        openingBalanceDate: values.openingBalanceDate
      }
    }
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
