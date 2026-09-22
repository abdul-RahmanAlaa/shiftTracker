import {
  listVehicles as listVehiclesRepo,
  listOpenShifts as listOpenShiftsRepo,
  VehicleRow
} from '../repository/listRepository'

type UseCaseResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: { field: string; message: string }[] }

export function listVehicles(): UseCaseResult<VehicleRow[]> {
  return { ok: true, data: listVehiclesRepo() }
}

export function listOpenShifts(): UseCaseResult<{ id: string }[]> {
  return { ok: true, data: listOpenShiftsRepo() }
}
