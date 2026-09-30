import {
  deleteLedgerById,
  getLedgerById,
  getShiftContractorId,
  insertLedger,
  updateLedger
} from '../repository/ledgerRepository'
import { getShiftById } from '../repository/shiftRepository'

type UseCaseResult<T> =
  { ok: true; data: T } | { ok: false; errors: { field: string; message: string }[] }

export interface CreateLedgerInput {
  entryDate: string
  driverId?: number
  movementType: 'ADVANCE' | 'PAYMENT' | 'OTHER'
  amount: number
  shiftId?: string
  contractorId?: number
  notes?: string
}

function validateLedgerInput(input: {
  entryDate: string
  movementType?: 'ADVANCE' | 'PAYMENT' | 'OTHER'
  amount?: number
  shiftId?: string
  contractorId?: number
}): { field: string; message: string }[] {
  const errors: { field: string; message: string }[] = []

  if (!input.entryDate?.trim()) errors.push({ field: 'entryDate', message: 'التاريخ مطلوب' })
  if (!input.movementType) errors.push({ field: 'movementType', message: 'نوع الحركة مطلوب' })
  if (!input.amount) errors.push({ field: 'amount', message: 'المبلغ مطلوب' })

  let contractorId: number | undefined = input.contractorId

  if (input.shiftId) {
    const derived = getShiftContractorId(input.shiftId)
    if (!derived) {
      errors.push({ field: 'shiftId', message: 'الوردية دي مش موجودة' })
    } else {
      contractorId = derived
    }
  } else if (!contractorId) {
    errors.push({ field: 'contractorId', message: 'مقاول النقل مطلوب لو الحركة مش مرتبطة بوردية' })
  }

  return errors
}

export function createLedgerEntry(input: CreateLedgerInput): UseCaseResult<{ id: number }> {
  const errors = validateLedgerInput(input)
  if (errors.length > 0) return { ok: false, errors }

  const contractorId = input.shiftId
    ? (getShiftContractorId(input.shiftId) ?? input.contractorId)
    : input.contractorId

  if (!contractorId) {
    return {
      ok: false,
      errors: [{ field: 'contractorId', message: 'مقاول النقل مطلوب لو الحركة مش مرتبطة بوردية' }]
    }
  }

  const id = insertLedger({
    entryDate: input.entryDate,
    driverId: input.driverId ?? null,
    movementType: input.movementType,
    amount: input.amount,
    shiftId: input.shiftId ?? null,
    contractorId,
    notes: input.notes ?? null
  })

  return { ok: true, data: { id } }
}

export interface UpdateLedgerEntryInput extends CreateLedgerInput {
  id: number
}

export function updateLedgerEntry(input: UpdateLedgerEntryInput): UseCaseResult<{ id: number }> {
  const errors: { field: string; message: string }[] = []

  if (!input.id) errors.push({ field: 'id', message: 'رقم الحركة مطلوب' })
  errors.push(...validateLedgerInput(input))

  if (errors.length > 0) return { ok: false, errors }

  const existingEntry = getLedgerById(input.id)
  if (!existingEntry) {
    return { ok: false, errors: [{ field: 'id', message: 'الحركة دي مش موجودة' }] }
  }

  const effectiveShiftId = input.shiftId ?? existingEntry.shiftId
  if (effectiveShiftId) {
    const shift = getShiftById(effectiveShiftId)
    if (shift?.status === 'CLOSED') {
      return {
        ok: false,
        errors: [{ field: 'id', message: 'مرتبطة بوردية مقفولة، لا يمكن تعديلها' }]
      }
    }
  }

  const contractorId = input.shiftId
    ? (getShiftContractorId(input.shiftId) ?? input.contractorId ?? existingEntry.contractorId)
    : (input.contractorId ?? existingEntry.contractorId)

  if (!contractorId) {
    return {
      ok: false,
      errors: [{ field: 'contractorId', message: 'مقاول النقل مطلوب لو الحركة مش مرتبطة بوردية' }]
    }
  }

  updateLedger({
    id: input.id,
    entryDate: input.entryDate,
    driverId: input.driverId ?? existingEntry.driverId ?? null,
    movementType: input.movementType,
    amount: input.amount,
    shiftId: effectiveShiftId ?? null,
    contractorId,
    notes: input.notes ?? existingEntry.notes ?? null
  })

  return { ok: true, data: { id: input.id } }
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
