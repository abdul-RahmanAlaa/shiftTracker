import { insertLedger, getShiftContractorId } from '../repository/ledgerRepository'

type UseCaseResult<T> =
  { ok: true; data: T } | { ok: false; errors: { field: string; message: string }[] }

export interface CreateLedgerInput {
  entryDate: string
  driverId?: number
  movementType: 'عهدة' | 'دفعة' | 'اخرى'
  amount: number
  shiftId?: string
  contractorId?: number
  notes?: string
}

export function createLedgerEntry(input: CreateLedgerInput): UseCaseResult<{ id: number }> {
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

  if (errors.length > 0) return { ok: false, errors }

  const id = insertLedger({
    entryDate: input.entryDate,
    driverId: input.driverId ?? null,
    movementType: input.movementType,
    amount: input.amount,
    shiftId: input.shiftId ?? null,
    contractorId: contractorId as number,
    notes: input.notes ?? null
  })

  return { ok: true, data: { id } }
}
