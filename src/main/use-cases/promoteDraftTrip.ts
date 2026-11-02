import { z } from 'zod'
import { getDb } from '../db'
import { deleteDraftTrip, getDraftTripById } from '../repository/draftTripRepository'
import { createTripInTransaction, createTripInputSchema } from './createTrip'
import type { CreateTripInput } from './createTrip'
import { UseCaseResult } from '../useCaseUtils'
import { positiveIntegerSchema } from '../validation'

const promoteDraftTripSchema = createTripInputSchema.extend({
  draftId: positiveIntegerSchema('ID_MUST_BE_POSITIVE')
})

class TripCreationRejected extends Error {
  constructor(readonly errors: { field: string; message: string }[]) {
    super('Draft promotion trip creation was rejected')
    this.name = 'TripCreationRejected'
  }
}

function validationErrors(error: z.ZodError): { field: string; message: string }[] {
  return error.issues.map((issue) => ({
    field: issue.path[0] === undefined ? 'root' : String(issue.path[0]),
    message: issue.message
  }))
}

export function promoteDraftTrip(
  input: { draftId: number } & CreateTripInput
): UseCaseResult<{ tripId: string }> {
  const parsed = promoteDraftTripSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: validationErrors(parsed.error) }

  const { draftId, ...tripInput } = parsed.data
  const db = getDb()

  try {
    return db.transaction((): UseCaseResult<{ tripId: string }> => {
      if (!getDraftTripById(db, draftId)) {
        return { ok: false, errors: [{ field: 'draftId', message: 'DRAFT_TRIP_NOT_FOUND' }] }
      }

      const tripResult = createTripInTransaction(tripInput)
      if (!tripResult.ok) throw new TripCreationRejected(tripResult.errors)

      if (!deleteDraftTrip(db, draftId)) {
        throw new Error(`Draft trip ${draftId} disappeared during promotion`)
      }
      return { ok: true, data: { tripId: tripResult.data.id } }
    })()
  } catch (error: unknown) {
    if (error instanceof TripCreationRejected) {
      return { ok: false, errors: error.errors }
    }
    throw error
  }
}
