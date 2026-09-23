import { ElectronAPI } from '@electron-toolkit/preload'

interface UseCaseResult<T> {
  ok: true
  data: T
}

interface FailedUseCaseResult {
  ok: false
  errors: { field: string; message: string }[]
}

interface TripRow {
  id: string
  shiftId: string
  tripDate: string
  crusherCubic: number
  clientCubicReported: number
  discountQty: number
  discountReason: string | null
  location: string | null
  crusherId: number
  stonePrice: number
  crusherReceiptStatus: string
  crusherReceiptNo: number | null
  clientId: number
  transportPrice: number
  clientPrice: number
  recipientNameStatus: string
  recipientName: string | null
  clientReceiptNo: string | null
  notes: string | null
}

interface ShiftFullRow {
  id: string
  vehicleNo: number
  driverId: number
  crusherCubicDefault: number
  clientCubicDefault: number
  status: string
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
  }) => Promise<UseCaseResult<{ id: number; name: string }> | FailedUseCaseResult>
  deleteDriver: (input: {
    id: number
  }) => Promise<UseCaseResult<{ id: number }> | FailedUseCaseResult>
  updateClient: (input: {
    id: number
    name: string
  }) => Promise<UseCaseResult<{ id: number; name: string }> | FailedUseCaseResult>
  deleteClient: (input: {
    id: number
  }) => Promise<UseCaseResult<{ id: number }> | FailedUseCaseResult>
  updateCrusher: (input: {
    id: number
    name: string
  }) => Promise<UseCaseResult<{ id: number; name: string }> | FailedUseCaseResult>
  deleteCrusher: (input: {
    id: number
  }) => Promise<UseCaseResult<{ id: number }> | FailedUseCaseResult>
  updateContractor: (input: {
    id: number
    name: string
  }) => Promise<UseCaseResult<{ id: number; name: string }> | FailedUseCaseResult>
  deleteContractor: (input: {
    id: number
  }) => Promise<UseCaseResult<{ id: number }> | FailedUseCaseResult>
  updateVehicle: (input: {
    vehicleNo: number
    trailerNo: number
    contractorId: number
  }) => Promise<UseCaseResult<{ vehicleNo: number }> | FailedUseCaseResult>
  deleteVehicle: (input: {
    vehicleNo: number
  }) => Promise<UseCaseResult<{ vehicleNo: number }> | FailedUseCaseResult>
  createTrip: (input: {
    shiftId: string
    tripDate: string
    crusherCubic: number
    clientCubicReported: number
    discountQty?: number
    discountReason?: string
    location?: string
    crusherId: number
    stonePrice: number
    crusherReceiptStatus: 'قيمة' | 'مفيش (متأكد)' | 'مش معروف'
    crusherReceiptNo?: number
    clientId: number
    transportPrice: number
    clientPrice: number
    recipientNameStatus?: 'قيمة' | 'مش واضح'
    recipientName?: string
    clientReceiptNo?: string
    notes?: string
  }) => Promise<UseCaseResult<{ id: string }> | FailedUseCaseResult>
  listTripsByShift: (input: {
    shiftId: string
  }) => Promise<UseCaseResult<TripRow[]> | FailedUseCaseResult>
  listTripLocations: () => Promise<UseCaseResult<string[]> | FailedUseCaseResult>
  getDriverOpenShift: (input: {
    driverId: number
  }) => Promise<UseCaseResult<ShiftFullRow | null> | FailedUseCaseResult>
  listCrushers: () => Promise<UseCaseResult<{ id: number; name: string }[]> | FailedUseCaseResult>
  listClients: () => Promise<UseCaseResult<{ id: number; name: string }[]> | FailedUseCaseResult>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
