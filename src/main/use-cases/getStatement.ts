import {
getClientEntity,
getContractorEntity,
getClientStatementCharges,
getClientStatementPayments,
getContractorStatementCharges,
getContractorStatementPayments,
StatementChargeRow,
StatementPaymentRow
} from '../repository/statementRepository'

type UseCaseResult<T> =
{ ok: true; data: T } | { ok: false; errors: { field: string; message: string }[] }

export interface StatementRow {
date: string
kind: 'OPENING' | 'CHARGE' | 'PAYMENT'
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

function buildStatement(
entityName: string,
openingBalance: number,
openingBalanceDate: string | null,
charges: StatementChargeRow[],
payments: StatementPaymentRow[]
): Statement {
type Draft = Omit<StatementRow, 'runningBalance'>

const draftRows: Draft[] = []

draftRows.push({
date: openingBalanceDate ?? charges[0]?.date ?? payments[0]?.date ?? '',
kind: 'OPENING',
description: null,
quantity: null,
price: null,
value: openingBalance,
payment: null,
notes: null
})

for (const c of charges) {
draftRows.push({
date: c.date,
kind: 'CHARGE',
description: c.description,
quantity: c.quantity,
price: c.price,
value: c.value,
payment: null,
notes: null
})
}

for (const p of payments) {
draftRows.push({
date: p.date,
kind: 'PAYMENT',
description: p.description,
quantity: null,
price: null,
value: null,
payment: p.amount,
notes: p.notes
})
}

draftRows.sort((a, b) => {
if (a.kind === 'OPENING') return -1
if (b.kind === 'OPENING') return 1
return a.date.localeCompare(b.date)
})

let balance = 0
const rows: StatementRow[] = draftRows.map((r) => {
balance += (r.value ?? 0) - (r.payment ?? 0)
return { ...r, runningBalance: balance }
})

return { entityName, rows, finalBalance: balance }
}

export function getClientStatement(input: { clientId: number }): UseCaseResult<Statement> {
if (!input.clientId) {
return { ok: false, errors: [{ field: 'clientId', message: 'العميل مطلوب' }] }
}
const entity = getClientEntity(input.clientId)
if (!entity) {
return { ok: false, errors: [{ field: 'clientId', message: 'العميل ده مش موجود' }] }
}
const charges = getClientStatementCharges(input.clientId)
const payments = getClientStatementPayments(input.clientId)
return {
ok: true,
data: buildStatement(entity.name, entity.openingBalance, entity.openingBalanceDate, charges, payments)
}
}

export function getContractorStatement(input: { contractorId: number }): UseCaseResult<Statement> {
if (!input.contractorId) {
return { ok: false, errors: [{ field: 'contractorId', message: 'مقاول النقل مطلوب' }] }
}
const entity = getContractorEntity(input.contractorId)
if (!entity) {
return { ok: false, errors: [{ field: 'contractorId', message: 'مقاول النقل ده مش موجود' }] }
}
const charges = getContractorStatementCharges(input.contractorId)
const payments = getContractorStatementPayments(input.contractorId)
return {
ok: true,
data: buildStatement(entity.name, entity.openingBalance, entity.openingBalanceDate, charges, payments)
}
}
