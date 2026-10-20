import { listAllTrips as listAllTripsRepo, TripWithContextRow } from '../repository/tripRepository'
import { fromMinorUnits } from '../accounting'
import { UseCaseResult } from '../useCaseUtils'

type PublicTripWithContextRow = Omit<
  TripWithContextRow,
  'fineAmountMinor' | 'stonePriceMinor' | 'transportPriceMinor' | 'clientPriceMinor'
> & {
  fineAmount: number
  stonePrice: number
  transportPrice: number
  clientPrice: number
}

export function listAllTrips(): UseCaseResult<PublicTripWithContextRow[]> {
  return {
    ok: true,
    data: listAllTripsRepo().map(
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
