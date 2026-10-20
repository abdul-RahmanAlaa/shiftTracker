import {
  getContractorAccountInputs,
  listLedgerByContractor,
  listLedgerByDriver
} from '../repository/accountsRepository'
import { LedgerRow } from '../repository/ledgerRepository'
import {
  getClientAccountInputs,
  listClientPayments,
  ClientPaymentRow
} from '../repository/accountsRepository'
import { calculateClientAccount, calculateContractorAccount, fromMinorUnits } from '../accounting'
import { UseCaseResult } from '../useCaseUtils'

type LedgerEntry = Omit<LedgerRow, 'amountMinor'> & { amount: number }

export interface ContractorAccount {
  transportTotal: number
  materialTotal: number
  ledgerTotal: number
  openingBalance: number
  balance: number
  entries: LedgerEntry[]
}

export function getContractorAccount(input: {
  contractorId: number
}): UseCaseResult<ContractorAccount> {
  if (!input.contractorId) {
    return { ok: false, errors: [{ field: 'contractorId', message: 'مقاول النقل مطلوب' }] }
  }
  const accountInputs = getContractorAccountInputs(input.contractorId)
  if (!accountInputs) {
    return { ok: false, errors: [{ field: 'contractorId', message: 'مقاول النقل ده مش موجود' }] }
  }
  const totals = calculateContractorAccount(accountInputs)
  const entries = listLedgerByContractor(input.contractorId).map(ledgerRowToPublic)
  return {
    ok: true,
    data: {
      transportTotal: fromMinorUnits(totals.transportMinor),
      materialTotal: fromMinorUnits(totals.materialMinor),
      ledgerTotal: fromMinorUnits(totals.settlementsMinor),
      openingBalance: fromMinorUnits(accountInputs.openingBalanceMinor),
      balance: fromMinorUnits(totals.balanceMinor),
      entries
    }
  }
}

export function getDriverHistory(input: { driverId: number }): UseCaseResult<LedgerEntry[]> {
  if (!input.driverId) {
    return { ok: false, errors: [{ field: 'driverId', message: 'السائق مطلوب' }] }
  }
  return { ok: true, data: listLedgerByDriver(input.driverId).map(ledgerRowToPublic) }
}

function ledgerRowToPublic(row: LedgerRow): LedgerEntry {
  const { amountMinor, ...rest } = row
  return { ...rest, amount: fromMinorUnits(amountMinor) }
}

export interface ClientAccount {
  receivableTotal: number
  fineTotal: number
  totalCubic: number
  paidTotal: number
  openingBalance: number
  balance: number
  payments: (Omit<ClientPaymentRow, 'amountMinor'> & { amount: number })[]
}

export function getClientAccount(input: { clientId: number }): UseCaseResult<ClientAccount> {
  if (!input.clientId) {
    return { ok: false, errors: [{ field: 'clientId', message: 'العميل مطلوب' }] }
  }
  const accountInputs = getClientAccountInputs(input.clientId)
  if (!accountInputs) {
    return { ok: false, errors: [{ field: 'clientId', message: 'العميل ده مش موجود' }] }
  }
  const totals = calculateClientAccount(accountInputs)
  const payments = listClientPayments(input.clientId).map((payment) => {
    const { amountMinor, ...rest } = payment
    return { ...rest, amount: fromMinorUnits(amountMinor) }
  })
  return {
    ok: true,
    data: {
      receivableTotal: fromMinorUnits(totals.receivableMinor),
      fineTotal: fromMinorUnits(totals.fineMinor),
      totalCubic: totals.totalCubic,
      paidTotal: fromMinorUnits(totals.paidMinor),
      openingBalance: fromMinorUnits(accountInputs.openingBalanceMinor),
      balance: fromMinorUnits(totals.balanceMinor),
      payments
    }
  }
}
