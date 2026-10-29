import {
  calculateClientAccount,
  calculateClientTrip,
  calculateContractorAccount,
  calculateContractorTrip,
  fromMinorUnits,
  sumMinorUnits
} from '../accounting'
import {
  getClientEntity,
  getContractorEntity,
  getClientStatementInputs,
  getContractorStatementInputs,
  StatementPaymentRow
} from '../repository/statementRepository'
import { mainMessages } from '../mainMessages'
import { UseCaseResult } from '../useCaseUtils'

export interface StatementRow {
  date: string
  kind: 'OPENING' | 'CHARGE' | 'FINE' | 'PAYMENT'
  component: 'TRANSPORT' | 'MATERIAL' | null
  description: string | null
  quantity: number | null
  price: number | null
  value: number | null
  payment: number | null
  notes: string | null
  runningBalance: number
}

export interface Statement {
  entityName: string
  rows: StatementRow[]
  finalBalance: number
}

interface DraftRow extends Omit<StatementRow, 'runningBalance' | 'value' | 'payment'> {
  valueMinor: number | null
  paymentMinor: number | null
  sortGroup: number
  sortId: string
  sortComponent: number
}

function compareText(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function compareSortIds(left: string, right: string): number {
  const leftTripId = /^TRP-(?:\d+-)?(\d+)$/.exec(left)
  const rightTripId = /^TRP-(?:\d+-)?(\d+)$/.exec(right)
  if (leftTripId && rightTripId) {
    const leftNumber = BigInt(leftTripId[1])
    const rightNumber = BigInt(rightTripId[1])
    if (leftNumber < rightNumber) return -1
    if (leftNumber > rightNumber) return 1
  }
  return compareText(left, right)
}

function buildStatement(
  entityName: string,
  openingBalanceMinor: number,
  openingBalanceDate: string | null,
  rows: DraftRow[]
): Statement {
  const draftRows: DraftRow[] = [
    {
      date: openingBalanceDate ?? rows[0]?.date ?? '',
      kind: 'OPENING',
      component: null,
      description: null,
      quantity: null,
      price: null,
      valueMinor: openingBalanceMinor,
      paymentMinor: null,
      notes: null,
      sortGroup: 0,
      sortId: '',
      sortComponent: 0
    },
    ...rows
  ]

  draftRows.sort((a, b) => {
    if (a.kind === 'OPENING') return -1
    if (b.kind === 'OPENING') return 1
    return (
      a.date.localeCompare(b.date) ||
      a.sortGroup - b.sortGroup ||
      compareSortIds(a.sortId, b.sortId) ||
      a.sortComponent - b.sortComponent
    )
  })

  let balanceMinor = 0
  const statementRows = draftRows.map((row): StatementRow => {
    balanceMinor = sumMinorUnits([balanceMinor, row.valueMinor ?? 0, -(row.paymentMinor ?? 0)])
    return {
      date: row.date,
      kind: row.kind,
      component: row.component,
      description: row.description,
      quantity: row.quantity,
      price: row.price,
      value: row.valueMinor === null ? null : fromMinorUnits(row.valueMinor),
      payment: row.paymentMinor === null ? null : fromMinorUnits(row.paymentMinor),
      notes: row.notes,
      runningBalance: fromMinorUnits(balanceMinor)
    }
  })
  return {
    entityName,
    rows: statementRows,
    finalBalance: fromMinorUnits(balanceMinor)
  }
}

function paymentRows(rows: StatementPaymentRow[], sortGroup: number): DraftRow[] {
  return [...rows]
    .sort(
      (left, right) =>
        compareText(left.date, right.date) ||
        compareText(left.description ?? '', right.description ?? '') ||
        left.amountMinor - right.amountMinor ||
        compareText(left.notes ?? '', right.notes ?? '')
    )
    .map((row, index) => ({
      date: row.date,
      kind: 'PAYMENT',
      component: null,
      description: row.description,
      quantity: null,
      price: null,
      valueMinor: null,
      paymentMinor: row.amountMinor,
      notes: row.notes,
      sortGroup,
      sortId: String(index).padStart(10, '0'),
      sortComponent: 0
    }))
}

export function getClientStatement(input: { clientId: number }): UseCaseResult<Statement> {
  if (!input.clientId) {
    return { ok: false, errors: [{ field: 'clientId', message: 'العميل مطلوب' }] }
  }
  const entity = getClientEntity(input.clientId)
  const account = getClientStatementInputs(input.clientId)
  if (!entity || !account) {
    return { ok: false, errors: [{ field: 'clientId', message: 'العميل ده مش موجود' }] }
  }
  const drafts: DraftRow[] = []
  for (const trip of account.trips) {
    const amounts = calculateClientTrip(trip)
    drafts.push({
      date: trip.date,
      kind: 'CHARGE',
      component: null,
      description: trip.description,
      quantity: trip.clientCubicReported,
      price: fromMinorUnits(trip.clientPriceMinor),
      valueMinor: amounts.chargeMinor,
      paymentMinor: null,
      notes: trip.notes?.trim() || null,
      sortGroup: 1,
      sortId: trip.id,
      sortComponent: 0
    })
    if (amounts.fineMinor > 0) {
      drafts.push({
        date: trip.date,
        kind: 'FINE',
        component: null,
        description: null,
        quantity: null,
        price: null,
        valueMinor: -amounts.fineMinor,
        paymentMinor: null,
        notes: trip.fineReason,
        sortGroup: 1,
        sortId: trip.id,
        sortComponent: 1
      })
    }
  }
  drafts.push(...paymentRows(account.payments, 2))

  const totals = calculateClientAccount(account)
  const statement = buildStatement(
    entity.name,
    account.openingBalanceMinor,
    entity.openingBalanceDate,
    drafts
  )
  if (statement.finalBalance !== fromMinorUnits(totals.balanceMinor)) {
    return {
      ok: false,
      errors: [{ field: 'root', message: mainMessages.accountingMismatch }]
    }
  }
  return { ok: true, data: statement }
}

export function getContractorStatement(input: { contractorId: number }): UseCaseResult<Statement> {
  if (!input.contractorId) {
    return { ok: false, errors: [{ field: 'contractorId', message: 'مقاول النقل مطلوب' }] }
  }
  const entity = getContractorEntity(input.contractorId)
  const account = getContractorStatementInputs(input.contractorId)
  if (!entity || !account) {
    return { ok: false, errors: [{ field: 'contractorId', message: 'مقاول النقل ده مش موجود' }] }
  }
  const drafts: DraftRow[] = []
  for (const trip of account.trips) {
    const amounts = calculateContractorTrip(trip)
    drafts.push(
      {
        date: trip.date,
        kind: 'CHARGE',
        component: 'TRANSPORT',
        description: trip.description,
        quantity: trip.clientCubicReported,
        price: fromMinorUnits(trip.transportPriceMinor),
        valueMinor: amounts.transportMinor,
        paymentMinor: null,
        notes: trip.notes?.trim() || null,
        sortGroup: 1,
        sortId: trip.id,
        sortComponent: 0
      },
      {
        date: trip.date,
        kind: 'CHARGE',
        component: 'MATERIAL',
        description: trip.description,
        quantity: trip.crusherCubic,
        price: fromMinorUnits(trip.stonePriceMinor),
        valueMinor: amounts.materialMinor,
        paymentMinor: null,
        notes: null,
        sortGroup: 1,
        sortId: trip.id,
        sortComponent: 1
      }
    )
  }
  drafts.push(...paymentRows(account.payments, 2))

  const totals = calculateContractorAccount(account)
  const statement = buildStatement(
    entity.name,
    account.openingBalanceMinor,
    entity.openingBalanceDate,
    drafts
  )
  if (statement.finalBalance !== fromMinorUnits(totals.balanceMinor)) {
    return {
      ok: false,
      errors: [{ field: 'root', message: mainMessages.accountingMismatch }]
    }
  }
  return { ok: true, data: statement }
}
