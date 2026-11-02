import { z } from 'zod'
import { getDb } from '../db'
import {
  CreateDraftTripInput,
  DraftTripListRow,
  UpdateDraftTripInput,
  deleteDraftTrip as deleteDraftTripInDb,
  insertDraftTrip,
  listDraftTrips as listDraftTripsInDb,
  updateDraftTrip as updateDraftTripInDb
} from '../repository/draftTripRepository'
import {
  dateStringSchema,
  positiveIntegerSchema,
  positiveNumberSchema,
  validationMessages
} from '../validation'
import { UseCaseResult, isSqliteError } from '../useCaseUtils'

const draftDateSchema = dateStringSchema(
  validationMessages.tripDateRequired,
  validationMessages.tripDateInvalid
)
const cubicSchema = positiveNumberSchema('CUBIC_MUST_BE_POSITIVE').lt(1e308, 'CUBIC_INVALID')
const custodyAmountSchema = positiveIntegerSchema('CUSTODY_AMOUNT_MUST_BE_POSITIVE')

const createDraftTripSchema = z.object({
  vehicleNo: positiveIntegerSchema('VEHICLE_NO_MUST_BE_POSITIVE'),
  tripDate: draftDateSchema,
  timeOfDay: z.enum(['MORNING', 'EVENING'], { error: 'TIME_OF_DAY_INVALID' }).optional(),
  crusherId: positiveIntegerSchema('CRUSHER_ID_INVALID').optional(),
  clientId: positiveIntegerSchema('CLIENT_ID_INVALID').optional(),
  cubic: cubicSchema.optional(),
  custodyAmount: custodyAmountSchema.optional(),
  custodyTime: z.string().optional(),
  receiptNote: z.string().optional(),
  notes: z.string().optional()
})

const updateDraftTripSchema = z.object({
  id: positiveIntegerSchema('ID_MUST_BE_POSITIVE'),
  tripDate: draftDateSchema,
  timeOfDay: z.enum(['MORNING', 'EVENING']).nullable(),
  crusherId: positiveIntegerSchema('CRUSHER_ID_INVALID').nullable(),
  clientId: positiveIntegerSchema('CLIENT_ID_INVALID').nullable(),
  cubic: cubicSchema.nullable(),
  custodyAmount: custodyAmountSchema.nullable(),
  custodyTime: z.string().nullable(),
  receiptNote: z.string().nullable(),
  notes: z.string().nullable()
})

const deleteDraftTripSchema = z.object({
  id: positiveIntegerSchema('ID_MUST_BE_POSITIVE')
})

function validationErrors(error: z.ZodError): { field: string; message: string }[] {
  return error.issues.map((issue) => ({
    field: issue.path[0] === undefined ? 'root' : String(issue.path[0]),
    message: issue.message
  }))
}

export function createDraftTrip(input: CreateDraftTripInput): UseCaseResult<{ id: number }> {
  const parsed = createDraftTripSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: validationErrors(parsed.error) }

  const db = getDb()
  try {
    const row = insertDraftTrip(db, parsed.data)
    return { ok: true, data: { id: row.id } }
  } catch (error: unknown) {
    if (isSqliteError(error) && error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      const vehicleExists = db
        .prepare('SELECT 1 FROM Vehicle WHERE vehicle_no = ?')
        .get(parsed.data.vehicleNo)
      const crusherExists =
        parsed.data.crusherId === undefined ||
        db.prepare('SELECT 1 FROM Crusher WHERE id = ?').get(parsed.data.crusherId)
      const clientExists =
        parsed.data.clientId === undefined ||
        db.prepare('SELECT 1 FROM Client WHERE id = ?').get(parsed.data.clientId)
      const field = !vehicleExists
        ? 'vehicleNo'
        : !crusherExists
          ? 'crusherId'
          : !clientExists
            ? 'clientId'
            : 'root'
      const message =
        field === 'vehicleNo'
          ? 'VEHICLE_NOT_FOUND'
          : field === 'crusherId'
            ? 'CRUSHER_NOT_FOUND'
            : field === 'clientId'
              ? 'CLIENT_NOT_FOUND'
              : 'DRAFT_TRIP_SAVE_FAILED'
      return { ok: false, errors: [{ field, message }] }
    }
    throw error
  }
}

export function updateDraftTrip(input: UpdateDraftTripInput): UseCaseResult<{ id: number }> {
  const parsed = updateDraftTripSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: validationErrors(parsed.error) }

  const db = getDb()
  try {
    const row = updateDraftTripInDb(db, parsed.data)
    if (!row) {
      return { ok: false, errors: [{ field: 'id', message: 'DRAFT_TRIP_NOT_FOUND' }] }
    }
    return { ok: true, data: { id: row.id } }
  } catch (error: unknown) {
    if (isSqliteError(error) && error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      const crusherExists =
        parsed.data.crusherId === null ||
        db.prepare('SELECT 1 FROM Crusher WHERE id = ?').get(parsed.data.crusherId)
      const clientExists =
        parsed.data.clientId === null ||
        db.prepare('SELECT 1 FROM Client WHERE id = ?').get(parsed.data.clientId)
      const field = !crusherExists ? 'crusherId' : !clientExists ? 'clientId' : 'root'
      const message =
        field === 'crusherId'
          ? 'CRUSHER_NOT_FOUND'
          : field === 'clientId'
            ? 'CLIENT_NOT_FOUND'
            : 'DRAFT_TRIP_UPDATE_FAILED'
      return { ok: false, errors: [{ field, message }] }
    }
    throw error
  }
}

export function deleteDraftTrip(input: { id: number }): UseCaseResult<{ id: number }> {
  const parsed = deleteDraftTripSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: validationErrors(parsed.error) }
  if (!deleteDraftTripInDb(getDb(), parsed.data.id)) {
    return { ok: false, errors: [{ field: 'id', message: 'DRAFT_TRIP_NOT_FOUND' }] }
  }
  return { ok: true, data: { id: parsed.data.id } }
}

export function listDraftTrips(): UseCaseResult<DraftTripListRow[]> {
  return { ok: true, data: listDraftTripsInDb(getDb()) }
}
