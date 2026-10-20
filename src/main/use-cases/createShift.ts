import { z } from 'zod'
import {
  getNextShiftId,
  getOpenShiftByDriver,
  getOpenShiftByVehicle,
  getVehicleContractorId,
  insertShift
} from '../repository/shiftRepository'
import {
  dateStringSchema,
  positiveIntegerSchema,
  positiveNumberSchema,
  validationMessages
} from '../validation'
import { UseCaseResult, isSqliteError } from '../useCaseUtils'

export interface CreateShiftInput {
  vehicleNo: number
  driverId: number
  crusherCubicDefault: number
  clientCubicDefault: number
  startDate: string
  reportedDestination?: string
  notes?: string
}

const createShiftSchema = z.object({
  vehicleNo: positiveIntegerSchema('رقم السيارة مطلوب'),
  driverId: positiveIntegerSchema('السائق مطلوب'),
  crusherCubicDefault: positiveNumberSchema('تكعيب الكسارة مطلوب'),
  clientCubicDefault: positiveNumberSchema('تكعيب العميل مطلوب'),
  startDate: dateStringSchema(
    validationMessages.shiftStartDateRequired,
    validationMessages.shiftStartDateInvalid
  )
})

const createShiftFieldMessages: Record<string, string> = {
  vehicleNo: 'رقم السيارة مطلوب',
  driverId: 'السائق مطلوب',
  crusherCubicDefault: 'تكعيب الكسارة مطلوب',
  clientCubicDefault: 'تكعيب العميل مطلوب'
}

function mapZodIssue(issue: z.ZodIssue): { field: string; message: string } {
  const field = String(issue.path[0] ?? 'root')
  if (field === 'startDate') return { field, message: issue.message }
  if (field in createShiftFieldMessages) {
    return { field, message: createShiftFieldMessages[field] }
  }
  return { field, message: issue.message }
}

export function createShift(input: CreateShiftInput): UseCaseResult<{ id: string }> {
  if (typeof input !== 'object' || input === null) {
    return { ok: false, errors: [{ field: 'vehicleNo', message: 'رقم السيارة مطلوب' }] }
  }

  if (Object.prototype.hasOwnProperty.call(input, 'reportedTripCount')) {
    return {
      ok: false,
      errors: [
        {
          field: 'reportedTripCount',
          message: 'عدد النقلات المُبلَّغ به لا يُحفظ عند إنشاء الوردية'
        }
      ]
    }
  }

  const parsed = createShiftSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map(mapZodIssue) }
  }

  const { vehicleNo, driverId, crusherCubicDefault, clientCubicDefault, startDate } = parsed.data

  const existingDriverShift = getOpenShiftByDriver(driverId)
  if (existingDriverShift) {
    return {
      ok: false,
      errors: [
        {
          field: 'driverId',
          message: `السائق ده عنده وردية مفتوحة بالفعل (${existingDriverShift.id})`
        }
      ]
    }
  }

  const existingVehicleShift = getOpenShiftByVehicle(vehicleNo)
  if (existingVehicleShift) {
    return {
      ok: false,
      errors: [
        {
          field: 'vehicleNo',
          message: `السيارة دي عندها وردية مفتوحة بالفعل (${existingVehicleShift.id})`
        }
      ]
    }
  }

  const contractorId = getVehicleContractorId(vehicleNo)
  if (contractorId === undefined) {
    return { ok: false, errors: [{ field: 'vehicleNo', message: 'السيارة أو السائق مش موجودين' }] }
  }

  const id = getNextShiftId()

  try {
    insertShift({
      id,
      vehicleNo,
      driverId,
      contractorId,
      crusherCubicDefault,
      clientCubicDefault,
      startDate,
      reportedDestination: input.reportedDestination ?? null,
      reportedTripCount: null,
      notes: input.notes ?? null
    })
    return { ok: true, data: { id } }
  } catch (err: unknown) {
    if (isSqliteError(err) && err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      return {
        ok: false,
        errors: [{ field: 'vehicleNo', message: 'السيارة أو السائق مش موجودين' }]
      }
    }
    throw err
  }
}
