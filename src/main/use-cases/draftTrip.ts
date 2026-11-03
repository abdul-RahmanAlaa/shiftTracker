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
import { mainMessages } from '../mainMessages'

const draftDateSchema = dateStringSchema(
  validationMessages.tripDateRequired,
  validationMessages.tripDateInvalid
)
const custodyDateSchema = dateStringSchema(
  mainMessages.custodyDateInvalid,
  mainMessages.custodyDateInvalid
)
const custodyTimeSchema = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, mainMessages.custodyTimeInvalid)
const cubicSchema = positiveNumberSchema(mainMessages.cubicMustBePositive).lt(
  1e308,
  mainMessages.cubicInvalid
)
const custodyAmountSchema = positiveIntegerSchema(mainMessages.custodyAmountMustBePositive)

const createDraftTripSchema = z.object({
  vehicleNo: positiveIntegerSchema(mainMessages.vehicleNoMustBePositive),
  tripDate: draftDateSchema,
  timeOfDay: z.enum(['MORNING', 'EVENING'], { error: mainMessages.timeOfDayInvalid }).optional(),
  crusherId: positiveIntegerSchema(mainMessages.crusherIdInvalid).optional(),
  clientId: positiveIntegerSchema(mainMessages.clientIdInvalid).optional(),
  cubic: cubicSchema.optional(),
  custodyAmount: custodyAmountSchema.optional(),
  custodyDate: custodyDateSchema.optional(),
  custodyTime: custodyTimeSchema.optional(),
  receiptNote: z.string().optional(),
  notes: z.string().optional()
})

const updateDraftTripSchema = z.object({
  id: positiveIntegerSchema(mainMessages.idMustBePositive),
  tripDate: draftDateSchema,
  timeOfDay: z.enum(['MORNING', 'EVENING'], { error: mainMessages.timeOfDayInvalid }).nullable(),
  crusherId: positiveIntegerSchema(mainMessages.crusherIdInvalid).nullable(),
  clientId: positiveIntegerSchema(mainMessages.clientIdInvalid).nullable(),
  cubic: cubicSchema.nullable(),
  custodyAmount: custodyAmountSchema.nullable(),
  custodyDate: custodyDateSchema.nullable().optional(),
  custodyTime: custodyTimeSchema.nullable(),
  receiptNote: z.string().nullable(),
  notes: z.string().nullable()
})

const deleteDraftTripSchema = z.object({
  id: positiveIntegerSchema(mainMessages.idMustBePositive)
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
          ? mainMessages.vehicleNotFound
          : field === 'crusherId'
            ? mainMessages.crusherNotFound
            : field === 'clientId'
              ? mainMessages.clientNotFound
              : mainMessages.draftTripSaveFailed
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
      return { ok: false, errors: [{ field: 'id', message: mainMessages.draftTripNotFound }] }
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
          ? mainMessages.crusherNotFound
          : field === 'clientId'
            ? mainMessages.clientNotFound
            : mainMessages.draftTripUpdateFailed
      return { ok: false, errors: [{ field, message }] }
    }
    throw error
  }
}

export function deleteDraftTrip(input: { id: number }): UseCaseResult<{ id: number }> {
  const parsed = deleteDraftTripSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: validationErrors(parsed.error) }
  if (!deleteDraftTripInDb(getDb(), parsed.data.id)) {
    return { ok: false, errors: [{ field: 'id', message: mainMessages.draftTripNotFound }] }
  }
  return { ok: true, data: { id: parsed.data.id } }
}

export function listDraftTrips(): UseCaseResult<DraftTripListRow[]> {
  return { ok: true, data: listDraftTripsInDb(getDb()) }
}
