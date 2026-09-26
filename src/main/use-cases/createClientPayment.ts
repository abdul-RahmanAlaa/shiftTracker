import {
  deleteClientPayment as deleteClientPaymentInDb,
  getClientPaymentById,
  insertClientPayment,
  updateClientPayment as updateClientPaymentInDb
} from '../repository/accountsRepository'

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

export interface UpdateClientPaymentInput extends CreateClientPaymentInput {
  id: number
}

export function updateClientPayment(
  input: UpdateClientPaymentInput
): UseCaseResult<{ id: number }> {
  const errors: { field: string; message: string }[] = []

  if (!input.id) errors.push({ field: 'id', message: 'رقم الدفعة مطلوب' })
  if (!input.entryDate?.trim()) errors.push({ field: 'entryDate', message: 'التاريخ مطلوب' })
  if (!input.clientId) errors.push({ field: 'clientId', message: 'العميل مطلوب' })
  if (!input.amount) errors.push({ field: 'amount', message: 'المبلغ مطلوب' })

  if (errors.length > 0) return { ok: false, errors }

  const existingPayment = getClientPaymentById(input.id)
  if (!existingPayment) {
    return { ok: false, errors: [{ field: 'id', message: 'الدفعة دي مش موجودة' }] }
  }

  updateClientPaymentInDb({
    id: input.id,
    entryDate: input.entryDate,
    clientId: input.clientId,
    amount: input.amount,
    notes: input.notes ?? existingPayment.notes ?? null
  })

  return { ok: true, data: { id: input.id } }
}

export function deleteClientPayment(input: { id: number }): UseCaseResult<{ id: number }> {
  if (!input.id) {
    return { ok: false, errors: [{ field: 'id', message: 'رقم الدفعة مطلوب' }] }
  }

  const existingPayment = getClientPaymentById(input.id)
  if (!existingPayment) {
    return { ok: false, errors: [{ field: 'id', message: 'الدفعة دي مش موجودة' }] }
  }

  deleteClientPaymentInDb(input.id)
  return { ok: true, data: { id: input.id } }
}
