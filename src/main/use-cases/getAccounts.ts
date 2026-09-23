import {
  getContractorAccountTotals,
  listLedgerByContractor,
  listLedgerByDriver
} from '../repository/accountsRepository'
import { LedgerRow } from '../repository/ledgerRepository'
import {
  getClientAccountTotals,
  listClientPayments,
  ClientPaymentRow
} from '../repository/accountsRepository'

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

export interface ClientAccount {
  receivableTotal: number
  paidTotal: number
  balance: number
  payments: ClientPaymentRow[]
}

export function getClientAccount(input: { clientId: number }): UseCaseResult<ClientAccount> {
  if (!input.clientId) {
    return { ok: false, errors: [{ field: 'clientId', message: 'العميل مطلوب' }] }
  }
  const totals = getClientAccountTotals(input.clientId)
  const payments = listClientPayments(input.clientId)
  return { ok: true, data: { ...totals, payments } }
}
