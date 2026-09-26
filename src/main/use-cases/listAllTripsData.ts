import { listAllTrips as listAllTripsRepo, TripWithContextRow } from '../repository/tripRepository'

type UseCaseResult<T> =
  { ok: true; data: T } | { ok: false; errors: { field: string; message: string }[] }

export function listAllTrips(): UseCaseResult<TripWithContextRow[]> {
  return { ok: true, data: listAllTripsRepo() }
}
