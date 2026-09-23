import {
  getContractorAccountTotals,
  listLedgerByContractor,
  listLedgerByDriver
} from '../repository/accountsRepository'
import { LedgerRow } from '../repository/ledgerRepository'

type UseCaseResult<T> =
  { ok: true; data: T } | { ok: false; errors: { field: string; message: string }[] }

export interface ContractorAccount {
  transportTotal: number
  ledgerTotal: number
  balance: number
  entries: LedgerRow[]
}

export function getContractorAccount(input: {
  contractorId: number
}): UseCaseResult<ContractorAccount> {
  if (!input.contractorId) {
    return { ok: false, errors: [{ field: 'contractorId', message: 'مقاول النقل مطلوب' }] }
  }
  const totals = getContractorAccountTotals(input.contractorId)
  const entries = listLedgerByContractor(input.contractorId)
  return { ok: true, data: { ...totals, entries } }
}

export function getDriverHistory(input: { driverId: number }): UseCaseResult<LedgerRow[]> {
  if (!input.driverId) {
    return { ok: false, errors: [{ field: 'driverId', message: 'السائق مطلوب' }] }
  }
  return { ok: true, data: listLedgerByDriver(input.driverId) }
}
