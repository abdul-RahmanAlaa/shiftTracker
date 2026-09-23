import {
  listVehicles as listVehiclesRepo,
  listOpenShifts as listOpenShiftsRepo,
  VehicleRow
} from '../repository/listRepository'
import { getOpenShiftByDriverFull, ShiftFullRow } from '../repository/shiftRepository'
import { listAllShifts as listAllShiftsRepo, ShiftListRow } from '../repository/shiftRepository'

type UseCaseResult<T> =
  { ok: true; data: T } | { ok: false; errors: { field: string; message: string }[] }

export function listVehicles(): UseCaseResult<VehicleRow[]> {
  return { ok: true, data: listVehiclesRepo() }
}

export function listOpenShifts(): UseCaseResult<{ id: string }[]> {
  return { ok: true, data: listOpenShiftsRepo() }
}

export function getDriverOpenShift(driverId: number): UseCaseResult<ShiftFullRow | null> {
  const shift = getOpenShiftByDriverFull(driverId)
  return { ok: true, data: shift ?? null }
}

export function listShifts(): UseCaseResult<ShiftListRow[]> {
  return { ok: true, data: listAllShiftsRepo() }
}
