import { z } from 'zod'
import { getDb } from '../db'
import { mainMessages } from '../mainMessages'
import { positiveIntegerSchema } from '../validation'
import { UseCaseResult } from '../useCaseUtils'
import { deleteDraftTrip, getDraftTripById } from '../repository/draftTripRepository'
import { createLedgerEntryInTransaction, ledgerCustodySchema } from './createLedgerEntry'
import { createTripInTransaction, createTripInputSchema } from './createTrip'
import type { CreateTripInput } from './createTrip'

export interface PromoteCustodyInput {
  entryDate: string
  entryTime?: string | null
  amount: number
  notes?: string | null
}

const promoteDraftTripSchema = createTripInputSchema.extend({
  draftId: positiveIntegerSchema(mainMessages.idMustBePositive),
  custody: ledgerCustodySchema.nullable().optional()
})

class PromotionRejected extends Error {
  constructor(readonly errors: { field: string; message: string }[]) {
    super('Draft promotion was rejected')
    this.name = 'PromotionRejected'
  }
}

function validationErrors(error: z.ZodError): { field: string; message: string }[] {
  return error.issues.map((issue) => ({
    field: issue.path[0] === undefined ? 'root' : String(issue.path[0]),
    message: issue.message
  }))
}

export function promoteDraftTrip(
  input: { draftId: number; custody?: PromoteCustodyInput | null } & CreateTripInput
): UseCaseResult<{ tripId: string; ledgerId: number | null }> {
  const parsed = promoteDraftTripSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: validationErrors(parsed.error) }

  const { draftId, custody, ...tripInput } = parsed.data
  const db = getDb()

  try {
    return db.transaction((): UseCaseResult<{ tripId: string; ledgerId: number | null }> => {
      const draft = getDraftTripById(db, draftId)
      if (!draft) {
        return {
          ok: false,
          errors: [{ field: 'draftId', message: mainMessages.draftTripNotFound }]
        }
      }

      const tripResult = createTripInTransaction({
        ...tripInput,
        timeOfDay: tripInput.timeOfDay === undefined ? draft.time_of_day : tripInput.timeOfDay
      })
      if (!tripResult.ok) throw new PromotionRejected(tripResult.errors)

      const resolvedCustody =
        custody === undefined && draft.custody_amount !== null
          ? {
              entryDate: draft.custody_date ?? draft.trip_date,
              entryTime: draft.custody_time,
              amount: draft.custody_amount
            }
          : custody

      let ledgerId: number | null = null
      if (resolvedCustody !== undefined && resolvedCustody !== null) {
        const shift = db
          .prepare('SELECT driver_id AS driverId FROM Shift WHERE id = ?')
          .get(tripInput.shiftId) as { driverId: number } | undefined
        if (!shift) {
          throw new PromotionRejected([{ field: 'shiftId', message: 'الوردية دي مش موجودة' }])
        }

        const ledgerResult = createLedgerEntryInTransaction({
          entryDate: resolvedCustody.entryDate,
          entryTime: resolvedCustody.entryTime,
          driverId: shift.driverId,
          movementType: 'ADVANCE',
          amount: resolvedCustody.amount,
          shiftId: tripInput.shiftId,
          notes: resolvedCustody.notes
        })
        if (!ledgerResult.ok) throw new PromotionRejected(ledgerResult.errors)
        ledgerId = ledgerResult.data.id
      }

      if (!deleteDraftTrip(db, draftId)) {
        throw new PromotionRejected([{ field: 'draftId', message: mainMessages.draftTripNotFound }])
      }
      return { ok: true, data: { tripId: tripResult.data.id, ledgerId } }
    })()
  } catch (error: unknown) {
    if (error instanceof PromotionRejected) {
      return { ok: false, errors: error.errors }
    }
    return {
      ok: false,
      errors: [{ field: 'root', message: mainMessages.draftTripPromoteFailed }]
    }
  }
}
