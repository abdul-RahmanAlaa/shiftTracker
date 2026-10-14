import { z } from 'zod'
import { fromMinorUnits } from '../accounting'
import { getSuggestedTripPriceInputs } from '../repository/tripRepository'
import { positiveIntegerSchema } from '../validation'

type UseCaseResult<T> =
  { ok: true; data: T } | { ok: false; errors: { field: string; message: string }[] }

export interface SuggestedTripPrices {
  source: 'LAST_TRIP' | 'DEFAULTS' | 'NONE'
  stonePrice: number | null
  transportPrice: number | null
  clientPrice: number | null
}

const suggestionInputSchema = z.object({
  clientId: positiveIntegerSchema('العميل مطلوب'),
  crusherId: positiveIntegerSchema('الكسارة مطلوبة')
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

  const prices = getSuggestedTripPriceInputs(parsed.data.clientId, parsed.data.crusherId)
  if (!prices.clientExists) {
    return { ok: false, errors: [{ field: 'clientId', message: 'العميل غير موجود' }] }
  }
  if (!prices.crusherExists) {
    return { ok: false, errors: [{ field: 'crusherId', message: 'الكسارة غير موجودة' }] }
  }

  if (prices.tripId !== null) {
    return {
      ok: true,
      data: {
        source: 'LAST_TRIP',
        stonePrice:
          prices.tripStonePriceMinor === null ? null : fromMinorUnits(prices.tripStonePriceMinor),
        transportPrice:
          prices.tripTransportPriceMinor === null
            ? null
            : fromMinorUnits(prices.tripTransportPriceMinor),
        clientPrice:
          prices.tripClientPriceMinor === null ? null : fromMinorUnits(prices.tripClientPriceMinor)
      }
    }
  }

  const stonePrice =
    prices.crusherInitialPriceMinor === null
      ? null
      : fromMinorUnits(prices.crusherInitialPriceMinor)
  const clientPrice =
    prices.clientInitialPriceMinor === null ? null : fromMinorUnits(prices.clientInitialPriceMinor)
  const transportPrice = null
  const source =
    stonePrice === null && transportPrice === null && clientPrice === null ? 'NONE' : 'DEFAULTS'

  return {
    ok: true,
    data: { source, stonePrice, transportPrice, clientPrice }
  }
}
