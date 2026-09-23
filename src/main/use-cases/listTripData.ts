import {
  listTripsByShift as listTripsByShiftRepo,
  listTripLocations as listTripLocationsRepo,
  TripRow
} from '../repository/tripRepository'

type UseCaseResult<T> =
  { ok: true; data: T } | { ok: false; errors: { field: string; message: string }[] }

export function listTripsByShift(shiftId: string): UseCaseResult<TripRow[]> {
  return { ok: true, data: listTripsByShiftRepo(shiftId) }
}

export function listTripLocations(): UseCaseResult<string[]> {
  return { ok: true, data: listTripLocationsRepo() }
}
