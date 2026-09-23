import {
  listVehicles as listVehiclesRepo,
  listOpenShifts as listOpenShiftsRepo,
  VehicleRow
} from '../repository/listRepository'
import { getOpenShiftByDriver as getOpenShiftByDriverRepo } from '../repository/shiftRepository'
import { getOpenShiftByDriverFull, ShiftFullRow } from '../repository/shiftRepository'

type UseCaseResult<T> =
  { ok: true; data: T } | { ok: false; errors: { field: string; message: string }[] }

export function listVehicles(): UseCaseResult<VehicleRow[]> {
  return { ok: true, data: listVehiclesRepo() }
}

export function listOpenShifts(): UseCaseResult<{ id: string }[]> {
  return { ok: true, data: listOpenShiftsRepo() }
}

export function getOpenShiftByDriver(input: {
  driverId: number
}): UseCaseResult<{ id: string } | null> {
  return { ok: true, data: getOpenShiftByDriverRepo(input.driverId) ?? null }
}

export function getDriverOpenShift(driverId: number): UseCaseResult<ShiftFullRow | null> {
  const shift = getOpenShiftByDriverFull(driverId)
  return { ok: true, data: shift ?? null }
}
