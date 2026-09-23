import { ElectronAPI } from '@electron-toolkit/preload'

interface UseCaseResult<T> {
  ok: true
  data: T
}

interface FailedUseCaseResult {
  ok: false
  errors: { field: string; message: string }[]
}

interface Api {
  createDriver: (input: {
    name: string
  }) => Promise<UseCaseResult<{ id: number; name: string }> | FailedUseCaseResult>
  createClient: (input: {
    name: string
  }) => Promise<UseCaseResult<{ id: number; name: string }> | FailedUseCaseResult>
  createCrusher: (input: {
    name: string
  }) => Promise<UseCaseResult<{ id: number; name: string }> | FailedUseCaseResult>
  createContractor: (input: {
    name: string
  }) => Promise<UseCaseResult<{ id: number; name: string }> | FailedUseCaseResult>
  createVehicle: (input: {
    vehicleNo: number
    trailerNo?: number
    contractorId: number
  }) => Promise<UseCaseResult<{ vehicleNo: number }> | FailedUseCaseResult>
  createShift: (input: {
    vehicleNo: number
    driverId: number
    crusherCubicDefault: number
    clientCubicDefault: number
    startDate: string
    reportedDestination?: string
    reportedTripCount?: number
    notes?: string
  }) => Promise<UseCaseResult<{ id: string }> | FailedUseCaseResult>
  closeShift: (input: {
    shiftId: string
    endDate: string
  }) => Promise<UseCaseResult<{ id: string }> | FailedUseCaseResult>
  listDrivers: () => Promise<UseCaseResult<{ id: number; name: string }[]> | FailedUseCaseResult>
  listContractors: () => Promise<
    UseCaseResult<{ id: number; name: string }[]> | FailedUseCaseResult
  >
  listVehicles: () => Promise<
    | UseCaseResult<{ vehicleNo: number; trailerNo: number | null; contractorId: number }[]>
    | FailedUseCaseResult
  >
  listOpenShifts: () => Promise<UseCaseResult<{ id: string }[]> | FailedUseCaseResult>
  updateDriver: (input: {
    id: number
    name: string
  }) => Promise<UseCaseResult<{ id: number; name: string }>>
  deleteDriver: (input: { id: number }) => Promise<UseCaseResult<{ id: number }>>
  updateClient: (input: {
    id: number
    name: string
  }) => Promise<UseCaseResult<{ id: number; name: string }>>
  deleteClient: (input: { id: number }) => Promise<UseCaseResult<{ id: number }>>
  updateCrusher: (input: {
    id: number
    name: string
  }) => Promise<UseCaseResult<{ id: number; name: string }>>
  deleteCrusher: (input: { id: number }) => Promise<UseCaseResult<{ id: number }>>
  updateContractor: (input: {
    id: number
    name: string
  }) => Promise<UseCaseResult<{ id: number; name: string }>>
  deleteContractor: (input: { id: number }) => Promise<UseCaseResult<{ id: number }>>
  updateVehicle: (input: {
    vehicleNo: number
    trailerNo: number
    contractorId: number
  }) => Promise<UseCaseResult<{ vehicleNo: number }>>
  deleteVehicle: (input: { vehicleNo: number }) => Promise<UseCaseResult<{ vehicleNo: number }>>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
