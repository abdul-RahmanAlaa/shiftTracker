import { ElectronAPI } from '@electron-toolkit/preload'

interface UseCaseResult<T> {
  ok: true
  data: T
}

interface FailedUseCaseResult {
  ok: false
  errors: { field: string; message: string }[]
}

interface AttachmentRow {
  id: number
  entityType: 'TRIP' | 'SHIFT'
  entityId: string
  kind: 'CRUSHER_RECEIPT' | 'CLIENT_RECEIPT' | 'CLOSING_SHEET'
  photoPath: string
  createdAt: string
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
  stonePrice: number | null
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

interface TripWithContextRow {
  id: string
  shiftId: string
  driverName: string
  vehicleNo: number
  tripDate: string
  location: string | null
  crusherName: string
  crusherCubic: number
  clientName: string
  clientCubicReported: number
  discountQty: number
  discountReason: string | null
  effectiveClientCubic: number
  stonePrice: number | null
  transportPrice: number
  clientPrice: number
  crusherReceiptStatus: string
  crusherReceiptNo: number | null
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
  startDate: string
  endDate: string | null
}

interface LedgerRow {
  id: number
  entryDate: string
  driverId: number | null
  movementType: string
  amount: number
  shiftId: string | null
  contractorId: number
  notes: string | null
}

interface ContractorAccount {
  transportTotal: number
  ledgerTotal: number
  balance: number
  entries: LedgerRow[]
}

interface CreateTripInput {
  shiftId: string
  tripDate: string
  crusherCubic: number
  clientCubicReported: number
  discountQty?: number
  discountReason?: string
  location?: string
  crusherId: number
  stonePrice: number
  crusherReceiptStatus: 'PROVIDED' | 'CONFIRMED_MISSING' | 'UNKNOWN'
  crusherReceiptNo?: number
  clientId: number
  transportPrice: number
  clientPrice: number
  recipientNameStatus?: 'PROVIDED' | 'UNCLEAR'
  recipientName?: string
  clientReceiptNo?: string
  notes?: string
}

interface ShiftListRow {
  id: string
  vehicleNo: number
  driverId: number
  driverName: string
  crusherCubicDefault: number
  clientCubicDefault: number
  status: string
  startDate: string
  endDate: string | null
  actualTripCount: number
}

interface ClientPaymentRow {
  id: number
  entryDate: string
  clientId: number
  amount: number
  notes: string | null
}

interface ClientAccount {
  receivableTotal: number
  totalCubic: number
  paidTotal: number
  balance: number
  payments: ClientPaymentRow[]
}

interface Api {
  createDriver: (input: {
    name: string
    phone1?: string
    phone2?: string
  }) => Promise<
    | UseCaseResult<{ id: number; name: string; phone1: string | null; phone2: string | null }>
    | FailedUseCaseResult
  >
  createClient: (input: {
    name: string
    initialPrice?: number
  }) => Promise<
    UseCaseResult<{ id: number; name: string; initialPrice: number | null }> | FailedUseCaseResult
  >
  createCrusher: (input: {
    name: string
    initialPrice?: number
  }) => Promise<
    UseCaseResult<{ id: number; name: string; initialPrice: number | null }> | FailedUseCaseResult
  >
  createContractor: (input: {
    name: string
    phone?: string
  }) => Promise<
    UseCaseResult<{ id: number; name: string; phone: string | null }> | FailedUseCaseResult
  >
  createVehicle: (input: {
    vehicleNo: number
    trailerNo: number
    contractorId: number
    defaultCubic?: number
    ownerName?: string
  }) => Promise<
    | UseCaseResult<{ vehicleNo: number; defaultCubic: number | null; ownerName: string | null }>
    | FailedUseCaseResult
  >
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
  listDrivers: () => Promise<
    | UseCaseResult<{ id: number; name: string; phone1: string | null; phone2: string | null }[]>
    | FailedUseCaseResult
  >
  listContractors: () => Promise<
    UseCaseResult<{ id: number; name: string; phone: string | null }[]> | FailedUseCaseResult
  >
  listVehicles: () => Promise<
    | UseCaseResult<
        {
          vehicleNo: number
          trailerNo: number
          contractorId: number
          defaultCubic: number | null
          ownerName: string | null
        }[]
      >
    | FailedUseCaseResult
  >
  listOpenShifts: () => Promise<UseCaseResult<{ id: string }[]> | FailedUseCaseResult>
  updateDriver: (input: {
    id: number
    name: string
    phone1?: string
    phone2?: string
  }) => Promise<
    | UseCaseResult<{ id: number; name: string; phone1: string | null; phone2: string | null }>
    | FailedUseCaseResult
  >
  deleteDriver: (input: {
    id: number
  }) => Promise<UseCaseResult<{ id: number }> | FailedUseCaseResult>
  updateClient: (input: {
    id: number
    name: string
    initialPrice?: number
  }) => Promise<
    UseCaseResult<{ id: number; name: string; initialPrice: number | null }> | FailedUseCaseResult
  >
  deleteClient: (input: {
    id: number
  }) => Promise<UseCaseResult<{ id: number }> | FailedUseCaseResult>
  updateCrusher: (input: {
    id: number
    name: string
    initialPrice?: number
  }) => Promise<
    UseCaseResult<{ id: number; name: string; initialPrice: number | null }> | FailedUseCaseResult
  >
  deleteCrusher: (input: {
    id: number
  }) => Promise<UseCaseResult<{ id: number }> | FailedUseCaseResult>
  updateContractor: (input: {
    id: number
    name: string
    phone?: string
  }) => Promise<
    UseCaseResult<{ id: number; name: string; phone: string | null }> | FailedUseCaseResult
  >
  deleteContractor: (input: {
    id: number
  }) => Promise<UseCaseResult<{ id: number }> | FailedUseCaseResult>
  updateVehicle: (input: {
    vehicleNo: number
    trailerNo: number
    contractorId: number
    defaultCubic?: number
    ownerName?: string
  }) => Promise<
    | UseCaseResult<{ vehicleNo: number; defaultCubic: number | null; ownerName: string | null }>
    | FailedUseCaseResult
  >
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
    crusherReceiptStatus: 'PROVIDED' | 'CONFIRMED_MISSING' | 'UNKNOWN'
    crusherReceiptNo?: number
    clientId: number
    transportPrice: number
    clientPrice: number
    recipientNameStatus?: 'PROVIDED' | 'UNCLEAR'
    recipientName?: string
    clientReceiptNo?: string
    notes?: string
  }) => Promise<UseCaseResult<{ id: string }> | FailedUseCaseResult>
  listTripsByShift: (input: {
    shiftId: string
  }) => Promise<UseCaseResult<TripRow[]> | FailedUseCaseResult>
  listTripLocations: () => Promise<UseCaseResult<string[]> | FailedUseCaseResult>
  listAllTrips: () => Promise<UseCaseResult<TripWithContextRow[]> | FailedUseCaseResult>
  getDriverOpenShift: (input: {
    driverId: number
  }) => Promise<UseCaseResult<ShiftFullRow | null> | FailedUseCaseResult>
  listCrushers: () => Promise<
    UseCaseResult<{ id: number; name: string; initialPrice: number | null }[]> | FailedUseCaseResult
  >
  listClients: () => Promise<
    UseCaseResult<{ id: number; name: string; initialPrice: number | null }[]> | FailedUseCaseResult
  >
  createLedgerEntry: (input: {
    entryDate: string
    driverId?: number
    movementType: 'ADVANCE' | 'PAYMENT' | 'OTHER'
    amount: number
    shiftId?: string
    contractorId?: number
    notes?: string
  }) => Promise<UseCaseResult<{ id: number }> | FailedUseCaseResult>
  updateLedgerEntry: (input: {
    id: number
    entryDate: string
    driverId?: number
    movementType: 'ADVANCE' | 'PAYMENT' | 'OTHER'
    amount: number
    shiftId?: string
    contractorId?: number
    notes?: string
  }) => Promise<UseCaseResult<{ id: number }> | FailedUseCaseResult>
  deleteLedgerEntry: (input: {
    id: number
  }) => Promise<UseCaseResult<{ id: number }> | FailedUseCaseResult>
  listLedgerEntries: () => Promise<UseCaseResult<LedgerRow[]> | FailedUseCaseResult>
  getContractorAccount: (input: {
    contractorId: number
  }) => Promise<UseCaseResult<ContractorAccount> | FailedUseCaseResult>
  getDriverHistory: (input: {
    driverId: number
  }) => Promise<UseCaseResult<LedgerRow[]> | FailedUseCaseResult>
  listShifts: () => Promise<UseCaseResult<ShiftListRow[]> | FailedUseCaseResult>
  updateTrip: (input: {
    id: string
    tripDate: string
    crusherCubic: number
    clientCubicReported: number
    discountQty?: number
    discountReason?: string
    location?: string
    crusherId: number
    stonePrice: number
    crusherReceiptStatus: 'PROVIDED' | 'CONFIRMED_MISSING' | 'UNKNOWN'
    crusherReceiptNo?: number
    clientId: number
    transportPrice: number
    clientPrice: number
    recipientNameStatus?: 'PROVIDED' | 'UNCLEAR'
    recipientName?: string
    clientReceiptNo?: string
    notes?: string
  }) => Promise<UseCaseResult<{ id: string }> | FailedUseCaseResult>
  deleteTrip: (input: {
    id: string
  }) => Promise<UseCaseResult<{ id: string }> | FailedUseCaseResult>
  addAttachment: (input: {
    entityType: 'TRIP' | 'SHIFT'
    entityId: string
    kind: 'CRUSHER_RECEIPT' | 'CLIENT_RECEIPT' | 'CLOSING_SHEET'
    imageBase64: string
  }) => Promise<UseCaseResult<{ id: number; path: string }> | FailedUseCaseResult>
  removeAttachment: (input: {
    id: number
  }) => Promise<UseCaseResult<{ id: number }> | FailedUseCaseResult>
  listEntityAttachments: (input: {
    entityType: 'TRIP' | 'SHIFT'
    entityId: string
  }) => Promise<UseCaseResult<AttachmentRow[]> | FailedUseCaseResult>
  getAttachmentPhoto: (input: {
    photoPath: string
  }) => Promise<UseCaseResult<{ dataUri: string | null }> | FailedUseCaseResult>
  getClientAccount: (input: {
    clientId: number
  }) => Promise<UseCaseResult<ClientAccount> | FailedUseCaseResult>
  createClientPayment: (input: {
    entryDate: string
    clientId: number
    amount: number
    notes?: string
  }) => Promise<UseCaseResult<{ id: number }> | FailedUseCaseResult>
  updateClientPayment: (input: {
    id: number
    entryDate: string
    clientId: number
    amount: number
    notes?: string
  }) => Promise<UseCaseResult<{ id: number }> | FailedUseCaseResult>
  deleteClientPayment: (input: {
    id: number
  }) => Promise<UseCaseResult<{ id: number }> | FailedUseCaseResult>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
