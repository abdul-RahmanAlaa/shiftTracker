import { insertClientPayment } from '../repository/accountsRepository'

type UseCaseResult<T> =
  { ok: true; data: T } | { ok: false; errors: { field: string; message: string }[] }

export interface CreateClientPaymentInput {
  entryDate: string
  clientId: number
  amount: number
  notes?: string
}

export function createClientPayment(
  input: CreateClientPaymentInput
): UseCaseResult<{ id: number }> {
  const errors: { field: string; message: string }[] = []

  if (!input.entryDate?.trim()) errors.push({ field: 'entryDate', message: 'التاريخ مطلوب' })
  if (!input.clientId) errors.push({ field: 'clientId', message: 'العميل مطلوب' })
  if (!input.amount) errors.push({ field: 'amount', message: 'المبلغ مطلوب' })

  if (errors.length > 0) return { ok: false, errors }

  const id = insertClientPayment({
    entryDate: input.entryDate,
    clientId: input.clientId,
    amount: input.amount,
    notes: input.notes ?? null
  })

  return { ok: true, data: { id } }
}
