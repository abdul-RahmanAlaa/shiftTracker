import {
  insertTrip,
  getNextTripId,
  getTripById,
  updateTrip as updateTripInDb,
  deleteTripById
} from '../repository/tripRepository'
import { getShiftById } from '../repository/shiftRepository'

type UseCaseResult<T> =
  { ok: true; data: T } | { ok: false; errors: { field: string; message: string }[] }

interface SqliteError extends Error {
  code: string
}

function isSqliteError(err: unknown): err is SqliteError {
  return (
    err instanceof Error && 'code' in err && typeof (err as { code: unknown }).code === 'string'
  )
}

interface TripFieldsInput {
  tripDate: string
  crusherCubic: number
  clientCubicReported: number
  discountQty?: number
  discountReason?: string
  location?: string
  crusherId: number
  stonePrice: number
  crusherReceiptStatus: 'قيمة' | 'مفيش (متأكد)' | 'مش معروف'
  crusherReceiptNo?: number
  clientId: number
  transportPrice: number
  clientPrice: number
  recipientNameStatus?: 'قيمة' | 'مش واضح'
  recipientName?: string
  clientReceiptNo?: string
  notes?: string
}

function validateTripFields(input: TripFieldsInput): { field: string; message: string }[] {
  const errors: { field: string; message: string }[] = []

  if (!input.tripDate?.trim()) errors.push({ field: 'tripDate', message: 'تاريخ النقلة مطلوب' })
  if (!input.crusherCubic) errors.push({ field: 'crusherCubic', message: 'تكعيب الكسارة مطلوب' })
  if (!input.clientCubicReported)
    errors.push({ field: 'clientCubicReported', message: 'تكعيب العميل مطلوب' })
  if (!input.crusherId) errors.push({ field: 'crusherId', message: 'الكسارة مطلوبة' })
  if (!input.stonePrice) errors.push({ field: 'stonePrice', message: 'سعر الحجر مطلوب' })
  if (!input.clientId) errors.push({ field: 'clientId', message: 'العميل مطلوب' })
  if (!input.transportPrice) errors.push({ field: 'transportPrice', message: 'سعر النقل مطلوب' })
  if (!input.clientPrice) errors.push({ field: 'clientPrice', message: 'سعر العميل مطلوب' })

  if (!input.crusherReceiptStatus) {
    errors.push({ field: 'crusherReceiptStatus', message: 'حالة إيصال الكسارة مطلوبة' })
  } else if (input.crusherReceiptStatus === 'قيمة' && !input.crusherReceiptNo) {
    errors.push({ field: 'crusherReceiptNo', message: 'رقم الإيصال مطلوب' })
  }

  const recipientNameStatus = input.recipientNameStatus ?? 'مش واضح'
  if (recipientNameStatus === 'قيمة' && !input.recipientName?.trim()) {
    errors.push({ field: 'recipientName', message: 'اسم المستلم مطلوب' })
  }

  return errors
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
  if (shift.status === 'منتهية') {
    return {
      ok: false,
      errors: [{ field: 'shiftId', message: 'الوردية دي مقفولة، مينفعش تضاف عليها نقلة' }]
    }
  }

  const recipientNameStatus = input.recipientNameStatus ?? 'مش واضح'
  const id = getNextTripId()

  try {
    insertTrip({
      id,
      shiftId: input.shiftId,
      tripDate: input.tripDate,
      crusherCubic: input.crusherCubic,
      clientCubicReported: input.clientCubicReported,
      discountQty: input.discountQty ?? 0,
      discountReason: input.discountReason ?? null,
      location: input.location ?? null,
      crusherId: input.crusherId,
      stonePrice: input.stonePrice,
      crusherReceiptStatus: input.crusherReceiptStatus,
      crusherReceiptNo:
        input.crusherReceiptStatus === 'قيمة' ? (input.crusherReceiptNo ?? null) : null,
      clientId: input.clientId,
      transportPrice: input.transportPrice,
      clientPrice: input.clientPrice,
      recipientNameStatus,
      recipientName: recipientNameStatus === 'قيمة' ? (input.recipientName ?? null) : null,
      clientReceiptNo: input.clientReceiptNo ?? null,
      notes: input.notes ?? null
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
      return {
        ok: false,
        errors: [{ field: 'crusherId', message: 'الكسارة أو العميل مش موجودين' }]
      }
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
  if (!shift || shift.status === 'منتهية') {
    return {
      ok: false,
      errors: [{ field: 'id', message: 'الوردية دي مقفولة، مينفعش تتعدل نقلة تابعة ليها' }]
    }
  }

  const recipientNameStatus = input.recipientNameStatus ?? 'مش واضح'

  try {
    updateTripInDb({
      id: input.id,
      tripDate: input.tripDate,
      crusherCubic: input.crusherCubic,
      clientCubicReported: input.clientCubicReported,
      discountQty: input.discountQty ?? 0,
      discountReason: input.discountReason ?? null,
      location: input.location ?? null,
      crusherId: input.crusherId,
      stonePrice: input.stonePrice,
      crusherReceiptStatus: input.crusherReceiptStatus,
      crusherReceiptNo:
        input.crusherReceiptStatus === 'قيمة' ? (input.crusherReceiptNo ?? null) : null,
      clientId: input.clientId,
      transportPrice: input.transportPrice,
      clientPrice: input.clientPrice,
      recipientNameStatus,
      recipientName: recipientNameStatus === 'قيمة' ? (input.recipientName ?? null) : null,
      clientReceiptNo: input.clientReceiptNo ?? null,
      notes: input.notes ?? null
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
      return {
        ok: false,
        errors: [{ field: 'crusherId', message: 'الكسارة أو العميل مش موجودين' }]
      }
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
  if (!shift || shift.status === 'منتهية') {
    return {
      ok: false,
      errors: [{ field: 'id', message: 'الوردية دي مقفولة، مينفعش تتمسح نقلة تابعة ليها' }]
    }
  }

  deleteTripById(input.id)
  return { ok: true, data: { id: input.id } }
}
