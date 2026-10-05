import { z } from 'zod'
import {
  deleteClientPayment as deleteClientPaymentInDb,
  getClientPaymentById,
  insertClientPayment,
  updateClientPayment as updateClientPaymentInDb
} from '../repository/accountsRepository'

type UseCaseResult<T> =
  { ok: true; data: T } | { ok: false; errors: { field: string; message: string }[] }

interface SqliteError extends Error {
  code: string
}

function isSqliteError(err: unknown): err is SqliteError {
  return err instanceof Error && 'code' in err && typeof err.code === 'string'
}

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

const positiveIdSchema = z
  .number({ error: 'المعرف لازم يكون رقمًا صحيحًا موجبًا' })
  .int()
  .positive()
const dateSchema = z
  .string({ error: 'التاريخ مطلوب' })
  .refine(isRealDate, 'أدخل تاريخًا صحيحًا بصيغة YYYY-MM-DD')
const amountSchema = z
  .number({ error: 'المبلغ لازم يكون رقمًا محدودًا وغير صفر' })
  .finite('المبلغ لازم يكون رقمًا محدودًا وغير صفر')
  .refine((amount) => amount !== 0, 'المبلغ لازم يكون رقمًا محدودًا وغير صفر')
const nullableNotesSchema = z.string().nullable()

const createClientPaymentInputSchema = z.object({
  entryDate: dateSchema,
  clientId: positiveIdSchema,
  amount: amountSchema,
  notes: nullableNotesSchema.optional()
})

const updateClientPaymentInputSchema = createClientPaymentInputSchema.extend({
  id: positiveIdSchema,
  notes: nullableNotesSchema
})

export type CreateClientPaymentInput = z.infer<typeof createClientPaymentInputSchema>
export type UpdateClientPaymentInput = z.infer<typeof updateClientPaymentInputSchema>

function validationErrors(error: z.ZodError): { field: string; message: string }[] {
  return error.issues.map((issue) => ({
    field: issue.path[0] === undefined ? 'entryDate' : String(issue.path[0]),
    message: issue.message
  }))
}

function paymentWriteFailure(err: unknown): UseCaseResult<{ id: number }> {
  if (isSqliteError(err) && err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    return { ok: false, errors: [{ field: 'clientId', message: 'العميل غير موجود' }] }
  }
  return { ok: false, errors: [{ field: 'root', message: 'تعذر حفظ دفعة العميل' }] }
}

export function createClientPayment(
  input: CreateClientPaymentInput
): UseCaseResult<{ id: number }> {
  const parsed = createClientPaymentInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: validationErrors(parsed.error) }
  const values = parsed.data

  try {
    const id = insertClientPayment({
      entryDate: values.entryDate,
      clientId: values.clientId,
      amount: values.amount,
      notes: values.notes ?? null
    })
    return { ok: true, data: { id } }
  } catch (err: unknown) {
    return paymentWriteFailure(err)
  }
}

export function updateClientPayment(
  input: UpdateClientPaymentInput
): UseCaseResult<{ id: number }> {
  const parsed = updateClientPaymentInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: validationErrors(parsed.error) }
  const values = parsed.data

  const existingPayment = getClientPaymentById(values.id)
  if (!existingPayment) {
    return { ok: false, errors: [{ field: 'id', message: 'الدفعة دي مش موجودة' }] }
  }

  try {
    updateClientPaymentInDb({
      id: values.id,
      entryDate: values.entryDate,
      clientId: values.clientId,
      amount: values.amount,
      notes: values.notes
    })
    return { ok: true, data: { id: values.id } }
  } catch (err: unknown) {
    return paymentWriteFailure(err)
  }
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
