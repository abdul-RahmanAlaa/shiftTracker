import { z } from 'zod'
import {
  insertTrip,
  getNextTripId,
  getTripById,
  updateTrip as updateTripInDb,
  deleteTripById
} from '../repository/tripRepository'
import { getShiftById } from '../repository/shiftRepository'
import { listAttachments, deleteAttachment } from '../repository/attachmentRepository'
import { deleteAttachmentPhotoFile } from '../photoStorage'
import { getDb } from '../db'
import { toMinorUnits } from '../accounting'
import {
  dateStringSchema,
  positiveIntegerSchema,
  positiveNumberSchema,
  positiveMoneySchema,
  nonNegativeMoneySchema,
  validationMessages
} from '../validation'
import { UseCaseResult, isSqliteError } from '../useCaseUtils'

interface TripFieldsInput {
  tripDate: string
  crusherCubic: number
  clientCubicReported: number
  fineAmount?: number
  fineReason?: string
  location?: string
  crusherId: number
  stonePrice: number
  crusherReceiptStatus: 'PROVIDED' | 'CONFIRMED_MISSING' | 'UNKNOWN'
  crusherReceiptNo?: number
  clientId: number
  transportPrice: number
  clientPrice: number
  materialTypeId: number
  recipientNameStatus?: 'PROVIDED' | 'UNCLEAR'
  recipientName?: string
  clientReceiptNo?: string
  notes?: string
}

const tripFieldMessages: Record<string, string> = {
  crusherCubic: 'تكعيب الكسارة مطلوب',
  clientCubicReported: 'تكعيب العميل مطلوب',
  crusherId: 'الكسارة مطلوبة',
  stonePrice: 'سعر الحجر مطلوب',
  clientId: 'العميل مطلوب',
  materialTypeId: 'نوع الصنف مطلوب',
  transportPrice: 'سعر النقل مطلوب',
  clientPrice: 'سعر العميل مطلوب',
  crusherReceiptStatus: 'حالة إيصال الكسارة مطلوبة',
  crusherReceiptNo: 'رقم الإيصال مطلوب',
  recipientNameStatus: 'حالة اسم المستلم مطلوبة',
  recipientName: 'اسم المستلم مطلوب',
  fineAmount: validationMessages.fineAmountNonNegative
}

const tripSchema = z
  .object({
    tripDate: dateStringSchema(
      validationMessages.tripDateRequired,
      validationMessages.tripDateInvalid
    ),
    crusherCubic: positiveNumberSchema('تكعيب الكسارة مطلوب'),
    clientCubicReported: positiveNumberSchema('تكعيب العميل مطلوب'),
    fineAmount: nonNegativeMoneySchema(validationMessages.fineAmountNonNegative).optional(),
    fineReason: z.string().optional(),
    location: z.string().optional(),
    crusherId: positiveIntegerSchema('الكسارة مطلوبة'),
    stonePrice: positiveMoneySchema('سعر الحجر مطلوب'),
    crusherReceiptStatus: z.enum(['PROVIDED', 'CONFIRMED_MISSING', 'UNKNOWN'], {
      message: 'حالة إيصال الكسارة مطلوبة'
    }),
    crusherReceiptNo: z
      .number({ error: 'رقم الإيصال مطلوب' })
      .int('رقم الإيصال مطلوب')
      .positive('رقم الإيصال مطلوب')
      .optional(),
    clientId: positiveIntegerSchema('العميل مطلوب'),
    transportPrice: positiveMoneySchema('سعر النقل مطلوب'),
    clientPrice: positiveMoneySchema('سعر العميل مطلوب'),
    materialTypeId: positiveIntegerSchema('نوع الصنف مطلوب'),
    recipientNameStatus: z.enum(['PROVIDED', 'UNCLEAR'], {
      message: 'حالة اسم المستلم مطلوبة'
    }),
    recipientName: z.string().optional(),
    clientReceiptNo: z.string().optional(),
    notes: z.string().optional()
  })
  .superRefine((values, context) => {
    if (values.crusherReceiptStatus === 'PROVIDED' && !Number.isInteger(values.crusherReceiptNo)) {
      context.addIssue({
        code: 'custom',
        path: ['crusherReceiptNo'],
        message: 'رقم الإيصال مطلوب'
      })
    }

    if (
      values.recipientNameStatus === 'PROVIDED' &&
      (typeof values.recipientName !== 'string' || !values.recipientName.trim())
    ) {
      context.addIssue({
        code: 'custom',
        path: ['recipientName'],
        message: 'اسم المستلم مطلوب'
      })
    }
  })

function normalizeTripIssue(issue: z.ZodIssue): { field: string; message: string } {
  const field = String(issue.path[0] ?? 'root')
  if (field === 'tripDate') return { field, message: issue.message }
  if (field in tripFieldMessages) {
    return { field, message: tripFieldMessages[field] }
  }
  return { field, message: issue.message }
}

function validateTripFields(input: TripFieldsInput): { field: string; message: string }[] {
  const parsed = tripSchema.safeParse(input)
  if (!parsed.success) {
    return parsed.error.issues.map(normalizeTripIssue)
  }
  return []
}

export interface CreateTripInput extends TripFieldsInput {
  shiftId: string
}

export function createTrip(input: CreateTripInput): UseCaseResult<{ id: string }> {
  const errors: { field: string; message: string }[] = []

  if (!input.shiftId?.trim()) errors.push({ field: 'shiftId', message: 'الوردية مطلوبة' })
  errors.push(...validateTripFields(input))

  if (errors.length > 0) return { ok: false, errors }

  const shift = getShiftById(input.shiftId)
  if (!shift) {
    return { ok: false, errors: [{ field: 'shiftId', message: 'الوردية دي مش موجودة' }] }
  }
  if (shift.status === 'CLOSED') {
    return {
      ok: false,
      errors: [{ field: 'shiftId', message: 'الوردية دي مقفولة، مينفعش تضاف عليها نقلة' }]
    }
  }

  const recipientNameStatus = input.recipientNameStatus ?? 'UNCLEAR'
  const fineAmountMinor = toMinorUnits(input.fineAmount ?? 0)
  const stonePriceMinor = toMinorUnits(input.stonePrice)
  const transportPriceMinor = toMinorUnits(input.transportPrice)
  const clientPriceMinor = toMinorUnits(input.clientPrice)
  if (fineAmountMinor === null) {
    return {
      ok: false,
      errors: [{ field: 'fineAmount', message: validationMessages.moneyDecimals }]
    }
  }
  if (stonePriceMinor === null) {
    return {
      ok: false,
      errors: [{ field: 'stonePrice', message: validationMessages.moneyDecimals }]
    }
  }
  if (transportPriceMinor === null) {
    return {
      ok: false,
      errors: [{ field: 'transportPrice', message: validationMessages.moneyDecimals }]
    }
  }
  if (clientPriceMinor === null) {
    return {
      ok: false,
      errors: [{ field: 'clientPrice', message: validationMessages.moneyDecimals }]
    }
  }
  const id = getNextTripId()

  try {
    insertTrip({
      id,
      shiftId: input.shiftId,
      tripDate: input.tripDate,
      crusherCubic: input.crusherCubic,
      clientCubicReported: input.clientCubicReported,
      fineAmountMinor,
      fineReason: input.fineReason ?? null,
      location: input.location ?? null,
      crusherId: input.crusherId,
      stonePriceMinor,
      crusherReceiptStatus: input.crusherReceiptStatus,
      crusherReceiptNo:
        input.crusherReceiptStatus === 'PROVIDED' ? (input.crusherReceiptNo ?? null) : null,
      clientId: input.clientId,
      transportPriceMinor,
      clientPriceMinor,
      recipientNameStatus,
      recipientName: recipientNameStatus === 'PROVIDED' ? (input.recipientName ?? null) : null,
      clientReceiptNo: input.clientReceiptNo ?? null,
      notes: input.notes ?? null,
      materialTypeId: input.materialTypeId
    })
    return { ok: true, data: { id } }
  } catch (err: unknown) {
    if (isSqliteError(err) && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return {
        ok: false,
        errors: [{ field: 'crusherReceiptNo', message: 'رقم الإيصال ده مسجل بالفعل لنفس الكسارة' }]
      }
    }
    if (isSqliteError(err) && err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      const db = getDb()
      const crusherOk = db.prepare('SELECT 1 FROM Crusher WHERE id = ?').get(input.crusherId)
      const clientOk = db.prepare('SELECT 1 FROM Client WHERE id = ?').get(input.clientId)
      const fkField = !crusherOk ? 'crusherId' : !clientOk ? 'clientId' : 'materialTypeId'
      const fkMessages: Record<string, string> = {
        crusherId: 'الكسارة مش موجودة',
        clientId: 'العميل مش موجود',
        materialTypeId: 'نوع الصنف مش موجود'
      }
      return { ok: false, errors: [{ field: fkField, message: fkMessages[fkField] }] }
    }
    throw err
  }
}

export interface UpdateTripInput extends TripFieldsInput {
  id: string
}

export function updateTrip(input: UpdateTripInput): UseCaseResult<{ id: string }> {
  const errors: { field: string; message: string }[] = []

  if (!input.id?.trim()) errors.push({ field: 'id', message: 'النقلة مطلوبة' })
  errors.push(...validateTripFields(input))

  if (errors.length > 0) return { ok: false, errors }

  const existingTrip = getTripById(input.id)
  if (!existingTrip) {
    return { ok: false, errors: [{ field: 'id', message: 'النقلة دي مش موجودة' }] }
  }

  const shift = getShiftById(existingTrip.shiftId)
  if (!shift || shift.status === 'CLOSED') {
    return {
      ok: false,
      errors: [{ field: 'id', message: 'الوردية دي مقفولة، مينفعش تتعدل نقلة تابعة ليها' }]
    }
  }

  const recipientNameStatus = input.recipientNameStatus ?? 'UNCLEAR'
  const fineAmountMinor = toMinorUnits(input.fineAmount ?? 0)
  const stonePriceMinor = toMinorUnits(input.stonePrice)
  const transportPriceMinor = toMinorUnits(input.transportPrice)
  const clientPriceMinor = toMinorUnits(input.clientPrice)
  if (fineAmountMinor === null) {
    return {
      ok: false,
      errors: [{ field: 'fineAmount', message: validationMessages.moneyDecimals }]
    }
  }
  if (stonePriceMinor === null) {
    return {
      ok: false,
      errors: [{ field: 'stonePrice', message: validationMessages.moneyDecimals }]
    }
  }
  if (transportPriceMinor === null) {
    return {
      ok: false,
      errors: [{ field: 'transportPrice', message: validationMessages.moneyDecimals }]
    }
  }
  if (clientPriceMinor === null) {
    return {
      ok: false,
      errors: [{ field: 'clientPrice', message: validationMessages.moneyDecimals }]
    }
  }

  try {
    updateTripInDb({
      id: input.id,
      tripDate: input.tripDate,
      crusherCubic: input.crusherCubic,
      clientCubicReported: input.clientCubicReported,
      fineAmountMinor,
      fineReason: input.fineReason ?? null,
      location: input.location ?? null,
      crusherId: input.crusherId,
      stonePriceMinor,
      crusherReceiptStatus: input.crusherReceiptStatus,
      crusherReceiptNo:
        input.crusherReceiptStatus === 'PROVIDED' ? (input.crusherReceiptNo ?? null) : null,
      clientId: input.clientId,
      transportPriceMinor,
      clientPriceMinor,
      recipientNameStatus,
      recipientName: recipientNameStatus === 'PROVIDED' ? (input.recipientName ?? null) : null,
      clientReceiptNo: input.clientReceiptNo ?? null,
      notes: input.notes ?? null,
      materialTypeId: input.materialTypeId
    })
    return { ok: true, data: { id: input.id } }
  } catch (err: unknown) {
    if (isSqliteError(err) && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return {
        ok: false,
        errors: [{ field: 'crusherReceiptNo', message: 'رقم الإيصال ده مسجل بالفعل لنفس الكسارة' }]
      }
    }
    if (isSqliteError(err) && err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      const db = getDb()
      const crusherOk = db.prepare('SELECT 1 FROM Crusher WHERE id = ?').get(input.crusherId)
      const clientOk = db.prepare('SELECT 1 FROM Client WHERE id = ?').get(input.clientId)
      const fkField = !crusherOk ? 'crusherId' : !clientOk ? 'clientId' : 'materialTypeId'
      const fkMessages: Record<string, string> = {
        crusherId: 'الكسارة مش موجودة',
        clientId: 'العميل مش موجود',
        materialTypeId: 'نوع الصنف مش موجود'
      }
      return { ok: false, errors: [{ field: fkField, message: fkMessages[fkField] }] }
    }
    throw err
  }
}

export function deleteTrip(input: { id: string }): UseCaseResult<{ id: string }> {
  if (!input.id?.trim()) {
    return { ok: false, errors: [{ field: 'id', message: 'النقلة مطلوبة' }] }
  }

  const existingTrip = getTripById(input.id)
  if (!existingTrip) {
    return { ok: false, errors: [{ field: 'id', message: 'النقلة دي مش موجودة' }] }
  }

  const shift = getShiftById(existingTrip.shiftId)
  if (!shift || shift.status === 'CLOSED') {
    return {
      ok: false,
      errors: [{ field: 'id', message: 'الوردية دي مقفولة، مينفعش تتمسح نقلة تابعة ليها' }]
    }
  }

  const attachments = listAttachments('TRIP', input.id)

  getDb().transaction(() => {
    deleteTripById(input.id)
    for (const attachment of attachments) {
      deleteAttachment(attachment.id)
    }
  })()

  for (const attachment of attachments) {
    try {
      deleteAttachmentPhotoFile(attachment.photoPath)
    } catch (err) {
      console.error('[deleteTrip] Failed to delete attachment file, orphan may remain:', err)
    }
  }

  return { ok: true, data: { id: input.id } }
}
