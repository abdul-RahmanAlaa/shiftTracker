import {
  listTripsByShift as listTripsByShiftRepo,
  listTripLocations as listTripLocationsRepo,
  TripRow
} from '../repository/tripRepository'
import { fromMinorUnits } from '../accounting'

type UseCaseResult<T> =
  { ok: true; data: T } | { ok: false; errors: { field: string; message: string }[] }

type PublicTripRow = Omit<
  TripRow,
  'fineAmountMinor' | 'stonePriceMinor' | 'transportPriceMinor' | 'clientPriceMinor'
> & {
  fineAmount: number
  stonePrice: number
  transportPrice: number
  clientPrice: number
}

export function listTripsByShift(shiftId: string): UseCaseResult<PublicTripRow[]> {
  return {
    ok: true,
    data: listTripsByShiftRepo(shiftId).map(
      ({ fineAmountMinor, stonePriceMinor, transportPriceMinor, clientPriceMinor, ...trip }) => ({
        ...trip,
        fineAmount: fromMinorUnits(fineAmountMinor),
        stonePrice: fromMinorUnits(stonePriceMinor),
        transportPrice: fromMinorUnits(transportPriceMinor),
        clientPrice: fromMinorUnits(clientPriceMinor)
      })
    )
  }
}

export function listTripLocations(): UseCaseResult<string[]> {
  return { ok: true, data: listTripLocationsRepo() }
}
