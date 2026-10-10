import { getDb } from '../db'
import {
  ClientAccountInputs,
  ContractorAccountTotals,
  getClientAccountInputs,
  getContractorAccountInputs
} from './accountsRepository'

export interface StatementEntity {
  name: string
  openingBalanceMinor: number
  openingBalanceDate: string | null
}

export interface StatementPaymentRow {
  date: string
  description: string | null
  amountMinor: number
  notes: string | null
}

export function getClientEntity(clientId: number): StatementEntity | undefined {
  const db = getDb()
  return db
    .prepare(
      'SELECT name, opening_balance as openingBalanceMinor, opening_balance_date as openingBalanceDate FROM Client WHERE id = ?'
    )
    .get(clientId) as StatementEntity | undefined
}

export function getContractorEntity(contractorId: number): StatementEntity | undefined {
  const db = getDb()
  return db
    .prepare(
      'SELECT name, opening_balance as openingBalanceMinor, opening_balance_date as openingBalanceDate FROM TransportContractor WHERE id = ?'
    )
    .get(contractorId) as StatementEntity | undefined
}

export function getClientStatementInputs(
  clientId: number
): (ClientAccountInputs & { payments: StatementPaymentRow[] }) | undefined {
  const account = getClientAccountInputs(clientId)
  if (!account) return undefined
  const payments = getDb()
    .prepare(
      `SELECT entry_date as date, notes as description, amount as amountMinor, notes
       FROM ClientPayment WHERE client_id = ? ORDER BY entry_date, id`
    )
    .all(clientId) as StatementPaymentRow[]
  return { ...account, payments }
}

export function getContractorStatementInputs(
  contractorId: number
): (ContractorAccountTotals & { payments: StatementPaymentRow[] }) | undefined {
  const account = getContractorAccountInputs(contractorId)
  if (!account) return undefined
  const payments = getDb()
    .prepare(
      `SELECT entry_date as date, movement_type as description, amount as amountMinor, notes
       FROM Ledger WHERE contractor_id = ? ORDER BY entry_date, id`
    )
    .all(contractorId) as StatementPaymentRow[]
  return { ...account, payments }
}
