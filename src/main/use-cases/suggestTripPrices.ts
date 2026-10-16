import { z } from 'zod'
import { fromMinorUnits } from '../accounting'
import { getSuggestedTripPriceInputs } from '../repository/tripRepository'
import { positiveIntegerSchema } from '../validation'

type UseCaseResult<T> =
  { ok: true; data: T } | { ok: false; errors: { field: string; message: string }[] }

export interface SuggestedTripPrices {
  stonePrice: number | null
  clientPrice: number | null
  transportPrice: number | null
  sources: {
    stonePrice: 'LAST_TRIP' | 'DEFAULT' | null
    clientPrice: 'LAST_TRIP' | 'DEFAULT' | null
    transportPrice: 'LAST_TRIP' | null
  }
}

const suggestionInputSchema = z.object({
  clientId: positiveIntegerSchema('العميل مطلوب'),
  crusherId: positiveIntegerSchema('الكسارة مطلوبة'),
  materialTypeId: positiveIntegerSchema('نوع الصنف غير صحيح').optional(),
  location: z
    .string({ error: 'المكان يجب أن يكون نصاً' })
    .optional()
    .transform((location) => location?.trim() || undefined)
})

export function getSuggestedTripPrices(input: unknown): UseCaseResult<SuggestedTripPrices> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, errors: [{ field: 'clientId', message: 'العميل مطلوب' }] }
  }

  const parsed = suggestionInputSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => ({
        field: String(issue.path[0] ?? 'clientId'),
        message: issue.message
      }))
    }
  }

  const prices = getSuggestedTripPriceInputs(parsed.data)
  if (!prices.clientExists) {
    return { ok: false, errors: [{ field: 'clientId', message: 'العميل غير موجود' }] }
  }
  if (!prices.crusherExists) {
    return { ok: false, errors: [{ field: 'crusherId', message: 'الكسارة غير موجودة' }] }
  }
  if (parsed.data.materialTypeId !== undefined && !prices.materialTypeExists) {
    return { ok: false, errors: [{ field: 'materialTypeId', message: 'نوع الصنف غير موجود' }] }
  }

  const stonePriceMinor =
    prices.stoneTripId !== null ? prices.stoneTripPriceMinor : prices.crusherInitialPriceMinor
  const clientPriceMinor =
    prices.clientTripId !== null ? prices.clientTripPriceMinor : prices.clientInitialPriceMinor
  const transportTripId =
    parsed.data.location !== undefined && prices.transportLocationTripId !== null
      ? prices.transportLocationTripId
      : prices.transportClientTripId
  const transportPriceMinor =
    parsed.data.location !== undefined && prices.transportLocationTripId !== null
      ? prices.transportLocationTripPriceMinor
      : prices.transportClientTripPriceMinor
  const stoneSource =
    prices.stoneTripId !== null
      ? 'LAST_TRIP'
      : prices.crusherInitialPriceMinor !== null
        ? 'DEFAULT'
        : null
  const clientSource =
    prices.clientTripId !== null
      ? 'LAST_TRIP'
      : prices.clientInitialPriceMinor !== null
        ? 'DEFAULT'
        : null

  return {
    ok: true,
    data: {
      stonePrice: stonePriceMinor === null ? null : fromMinorUnits(stonePriceMinor),
      clientPrice: clientPriceMinor === null ? null : fromMinorUnits(clientPriceMinor),
      transportPrice: transportPriceMinor === null ? null : fromMinorUnits(transportPriceMinor),
      sources: {
        stonePrice: stoneSource,
        clientPrice: clientSource,
        transportPrice: transportTripId === null ? null : 'LAST_TRIP'
      }
    }
  }
}
