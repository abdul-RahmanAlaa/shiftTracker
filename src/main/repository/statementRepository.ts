import { getDb } from '../db'

export interface StatementEntity {
name: string
openingBalance: number
openingBalanceDate: string | null
}

export interface StatementChargeRow {
date: string
description: string | null
quantity: number | null
price: number | null
value: number
}

export interface StatementPaymentRow {
date: string
description: string | null
amount: number
notes: string | null
}

export function getClientEntity(clientId: number): StatementEntity | undefined {
const db = getDb()
return db
.prepare(
`SELECT name, opening_balance as openingBalance, opening_balance_date as openingBalanceDate        FROM Client WHERE id = ?`
)
.get(clientId) as StatementEntity | undefined
}

export function getContractorEntity(contractorId: number): StatementEntity | undefined {
const db = getDb()
return db
.prepare(
`SELECT name, opening_balance as openingBalance, opening_balance_date as openingBalanceDate        FROM TransportContractor WHERE id = ?`
)
.get(contractorId) as StatementEntity | undefined
}

export function getClientStatementCharges(clientId: number): StatementChargeRow[] {
const db = getDb()
return db
.prepare(
`      SELECT         t.trip_date as date,         mt.name as description,         (t.client_cubic_reported - t.discount_qty) as quantity,         t.client_price as price,         (t.client_cubic_reported - t.discount_qty) * t.client_price as value       FROM Trip t       LEFT JOIN MaterialType mt ON mt.id = t.material_type_id       WHERE t.client_id = ?       ORDER BY t.trip_date, t.id    `
)
.all(clientId) as StatementChargeRow[]
}

export function getClientStatementPayments(clientId: number): StatementPaymentRow[] {
const db = getDb()
return db
.prepare(
`SELECT entry_date as date, notes as description, amount, notes        FROM ClientPayment WHERE client_id = ? ORDER BY entry_date, id`
)
.all(clientId) as StatementPaymentRow[]
}

export function getContractorStatementCharges(contractorId: number): StatementChargeRow[] {
const db = getDb()
return db
.prepare(
`      SELECT         t.trip_date as date,         mt.name as description,         t.crusher_cubic as quantity,         t.transport_price as price,         t.crusher_cubic * t.transport_price as value       FROM Trip t       JOIN Shift s ON s.id = t.shift_id       JOIN Vehicle v ON v.vehicle_no = s.vehicle_no       LEFT JOIN MaterialType mt ON mt.id = t.material_type_id       WHERE v.contractor_id = ?       ORDER BY t.trip_date, t.id    `
)
.all(contractorId) as StatementChargeRow[]
}

export function getContractorStatementPayments(contractorId: number): StatementPaymentRow[] {
const db = getDb()
return db
.prepare(
`SELECT entry_date as date, movement_type as description, amount, notes        FROM Ledger WHERE contractor_id = ? ORDER BY entry_date, id`
)
.all(contractorId) as StatementPaymentRow[]
}
