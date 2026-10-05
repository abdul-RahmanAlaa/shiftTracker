import { z } from 'zod'
import {
  deleteLedgerById,
  getLedgerById,
  getShiftContractorId,
  insertLedger,
  updateLedger
} from '../repository/ledgerRepository'
import { getContractorById } from '../repository/contractorRepository'
import { driverExists } from '../repository/driverRepository'
import { getShiftById } from '../repository/shiftRepository'

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
const movementTypeSchema = z.enum(['ADVANCE', 'PAYMENT', 'OTHER'], {
  error: 'نوع الحركة مطلوب'
})
const amountSchema = z
  .number({ error: 'المبلغ لازم يكون رقمًا محدودًا وغير صفر' })
  .finite('المبلغ لازم يكون رقمًا محدودًا وغير صفر')
  .refine((amount) => amount !== 0, 'المبلغ لازم يكون رقمًا محدودًا وغير صفر')
const nullableDriverIdSchema = positiveIdSchema.nullable()
const nullableShiftIdSchema = z.string().min(1).nullable()
const nullableContractorIdSchema = positiveIdSchema.nullable()
const nullableNotesSchema = z.string().nullable()

const createLedgerInputSchema = z.object({
  entryDate: dateSchema,
  driverId: nullableDriverIdSchema.optional(),
  movementType: movementTypeSchema,
  amount: amountSchema,
  shiftId: nullableShiftIdSchema.optional(),
  contractorId: nullableContractorIdSchema.optional(),
  notes: nullableNotesSchema.optional()
})

const updateLedgerInputSchema = createLedgerInputSchema.extend({
  id: positiveIdSchema,
  driverId: nullableDriverIdSchema,
  shiftId: nullableShiftIdSchema,
  contractorId: nullableContractorIdSchema,
  notes: nullableNotesSchema
})

export type CreateLedgerInput = z.infer<typeof createLedgerInputSchema>
export type UpdateLedgerEntryInput = z.infer<typeof updateLedgerInputSchema>

function validationErrors(error: z.ZodError): { field: string; message: string }[] {
  return error.issues.map((issue) => ({
    field: issue.path[0] === undefined ? 'entryDate' : String(issue.path[0]),
    message: issue.message
  }))
}

type LedgerForeignKeyField = 'driverId' | 'shiftId' | 'contractorId'

function ledgerForeignKeyField(input: {
  driverId: number | null | undefined
  shiftId: string | null | undefined
  contractorId: number | null | undefined
  resolvedContractorId: number
}): LedgerForeignKeyField {
  if (input.driverId != null && !driverExists(input.driverId)) return 'driverId'
  if (input.shiftId != null && getShiftContractorId(input.shiftId) === undefined) return 'shiftId'
  if (!getContractorById(input.resolvedContractorId)) return 'contractorId'
  return input.shiftId != null ? 'shiftId' : 'contractorId'
}

function ledgerWriteFailure(
  err: unknown,
  input: Parameters<typeof ledgerForeignKeyField>[0],
  message: string
): UseCaseResult<{ id: number }> {
  if (isSqliteError(err) && err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    const field = ledgerForeignKeyField(input)
    const fieldMessages: Record<LedgerForeignKeyField, string> = {
      driverId: 'السائق غير موجود',
      shiftId: 'الوردية غير موجودة',
      contractorId: 'مقاول النقل غير موجود'
    }
    return { ok: false, errors: [{ field, message: fieldMessages[field] }] }
  }
  return { ok: false, errors: [{ field: 'root', message }] }
}

export function createLedgerEntry(input: CreateLedgerInput): UseCaseResult<{ id: number }> {
  const parsed = createLedgerInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: validationErrors(parsed.error) }
  const values = parsed.data

  let contractorId: number | null = values.contractorId ?? null
  if (values.shiftId) {
    const shiftContractorId = getShiftContractorId(values.shiftId)
    if (shiftContractorId === undefined) {
      return { ok: false, errors: [{ field: 'shiftId', message: 'الوردية دي مش موجودة' }] }
    }
    contractorId = shiftContractorId
  }

  if (contractorId === null) {
    return {
      ok: false,
      errors: [{ field: 'contractorId', message: 'مقاول النقل مطلوب لو الحركة مش مرتبطة بوردية' }]
    }
  }

  try {
    const id = insertLedger({
      entryDate: values.entryDate,
      driverId: values.driverId ?? null,
      movementType: values.movementType,
      amount: values.amount,
      shiftId: values.shiftId ?? null,
      contractorId,
      notes: values.notes ?? null
    })
    return { ok: true, data: { id } }
  } catch (err: unknown) {
    return ledgerWriteFailure(
      err,
      {
        driverId: values.driverId,
        shiftId: values.shiftId,
        contractorId: values.contractorId,
        resolvedContractorId: contractorId
      },
      'تعذر حفظ الحركة'
    )
  }
}

export function updateLedgerEntry(input: UpdateLedgerEntryInput): UseCaseResult<{ id: number }> {
  const parsed = updateLedgerInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: validationErrors(parsed.error) }
  const values = parsed.data

  const existingEntry = getLedgerById(values.id)
  if (!existingEntry) {
    return { ok: false, errors: [{ field: 'id', message: 'الحركة دي مش موجودة' }] }
  }

  let contractorId: number | null = values.contractorId
  if (values.shiftId !== null) {
    const shiftContractorId = getShiftContractorId(values.shiftId)
    if (shiftContractorId === undefined) {
      return { ok: false, errors: [{ field: 'shiftId', message: 'الوردية دي مش موجودة' }] }
    }
    contractorId = shiftContractorId
  }

  const shiftsToCheck = values.shiftId === null ? [existingEntry.shiftId] : [values.shiftId]
  for (const shiftId of shiftsToCheck) {
    if (shiftId === null) continue
    const shift = getShiftById(shiftId)
    if (shift?.status === 'CLOSED') {
      return {
        ok: false,
        errors: [{ field: 'id', message: 'مرتبطة بوردية مقفولة، لا يمكن تعديلها' }]
      }
    }
  }

  if (contractorId === null) {
    return {
      ok: false,
      errors: [{ field: 'contractorId', message: 'مقاول النقل مطلوب لو الحركة مش مرتبطة بوردية' }]
    }
  }

  try {
    updateLedger({
      id: values.id,
      entryDate: values.entryDate,
      driverId: values.driverId,
      movementType: values.movementType,
      amount: values.amount,
      shiftId: values.shiftId,
      contractorId,
      notes: values.notes
    })
    return { ok: true, data: { id: values.id } }
  } catch (err: unknown) {
    return ledgerWriteFailure(
      err,
      {
        driverId: values.driverId,
        shiftId: values.shiftId,
        contractorId: values.contractorId,
        resolvedContractorId: contractorId
      },
      'تعذر حفظ الحركة'
    )
  }
}

export function deleteLedgerEntry(input: { id: number }): UseCaseResult<{ id: number }> {
  if (!input.id) {
    return { ok: false, errors: [{ field: 'id', message: 'رقم الحركة مطلوب' }] }
  }

  const existingEntry = getLedgerById(input.id)
  if (!existingEntry) {
    return { ok: false, errors: [{ field: 'id', message: 'الحركة دي مش موجودة' }] }
  }

  if (existingEntry.shiftId) {
    const shift = getShiftById(existingEntry.shiftId)
    if (shift?.status === 'CLOSED') {
      return {
        ok: false,
        errors: [{ field: 'id', message: 'مرتبطة بوردية مقفولة، لا يمكن مسحها' }]
      }
    }
  }

  deleteLedgerById(input.id)
  return { ok: true, data: { id: input.id } }
}
