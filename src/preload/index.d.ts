import type {
  CreateDraftTripInput,
  DraftTripListRow,
  UpdateDraftTripInput
} from '../main/repository/draftTripRepository'
import type { OpenShiftCard } from '../main/repository/dashboardRepository'
import type { CreateTripInput } from '../main/use-cases/createTrip'
import type { PromoteCustodyInput } from '../main/use-cases/promoteDraftTrip'

export type { DraftTripListRow } from '../main/repository/draftTripRepository'
export type { OpenShiftCard } from '../main/repository/dashboardRepository'
export type { PromoteCustodyInput } from '../main/use-cases/promoteDraftTrip'

interface UseCaseResult<T> {
  ok: true
  data: T
}

/** Includes the `_form` fallback returned when an IPC handler or invoke fails. */
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

interface LedgerAttachmentRow extends Omit<AttachmentRow, 'entityType' | 'kind'> {
  entityType: 'LEDGER'
  kind: 'TRANSFER_RECEIPT'
}

type CreateTripApiInput = Omit<CreateTripInput, 'timeOfDay'> | CreateTripInput
type UpdateTripApiInput = Omit<CreateTripInput, 'shiftId'> & { id: string }
type CompatibleUpdateTripApiInput = Omit<UpdateTripApiInput, 'timeOfDay'> | UpdateTripApiInput

type CreateLedgerEntryInput = {
  entryDate: string
  entryTime?: string | null
  driverId?: number
  movementType: 'ADVANCE' | 'PAYMENT' | 'OTHER'
  amount: number
  shiftId?: string
  contractorId?: number
  notes?: string
}
type CompatibleCreateLedgerEntryInput =
  Omit<CreateLedgerEntryInput, 'entryTime'> | CreateLedgerEntryInput

type UpdateLedgerEntryInput = {
  id: number
  entryDate: string
  entryTime?: string | null
  driverId: number | null
  movementType: 'ADVANCE' | 'PAYMENT' | 'OTHER'
  amount: number
  shiftId: string | null
  contractorId: number | null
  notes: string | null
}
type CompatibleUpdateLedgerEntryInput =
  Omit<UpdateLedgerEntryInput, 'entryTime'> | UpdateLedgerEntryInput

interface MaterialTypeRow {
  id: number
  name: string
}

interface StatementRow {
  date: string
  kind: 'OPENING' | 'CHARGE' | 'FINE' | 'PAYMENT'
  component: 'TRANSPORT' | 'MATERIAL' | null
  description: string | null
  quantity: number | null
  price: number | null
  value: number | null
  payment: number | null
  notes: string | null
  runningBalance: number
}

interface Statement {
  entityName: string
  rows: StatementRow[]
  finalBalance: number
}

interface TripRow {
  id: string
  shiftId: string
  tripDate: string
  timeOfDay: 'MORNING' | 'EVENING' | null
  crusherCubic: number
  clientCubicReported: number
  fineAmount: number
  fineReason: string | null
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
  materialTypeId: number | null
}

interface TripWithContextRow {
  id: string
  shiftId: string
  shiftStatus: string
  driverName: string
  vehicleNo: number
  tripDate: string
  timeOfDay: 'MORNING' | 'EVENING' | null
  location: string | null
  crusherName: string
  crusherCubic: number
  clientName: string
  clientCubicReported: number
  fineAmount: number
  fineReason: string | null
  stonePrice: number
  transportPrice: number
  clientPrice: number
  crusherReceiptStatus: string
  crusherReceiptNo: number | null
  recipientNameStatus: string
  recipientName: string | null
  clientReceiptNo: string | null
  notes: string | null
  materialTypeId: number | null
  materialTypeName: string | null
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
  entryTime: string | null
  driverId: number | null
  movementType: 'ADVANCE' | 'PAYMENT' | 'OTHER'
  amount: number
  shiftId: string | null
  contractorId: number
  notes: string | null
}

interface ContractorAccount {
  transportTotal: number
  materialTotal: number
  ledgerTotal: number
  openingBalance: number
  balance: number
  entries: LedgerRow[]
}

interface SuggestedTripPrices {
  stonePrice: number | null
  clientPrice: number | null
  transportPrice: number | null
  sources: {
    stonePrice: 'LAST_TRIP' | 'DEFAULT' | null
    clientPrice: 'LAST_TRIP' | 'DEFAULT' | null
    transportPrice: 'LAST_TRIP' | null
  }
}

interface ShiftListRow {
  id: string
  vehicleNo: number
  driverId: number
  contractorId: number
  driverName: string
  crusherCubicDefault: number
  clientCubicDefault: number
  status: string
  startDate: string
  endDate: string | null
  actualTripCount: number
  reportedTripCount: number | null
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
  fineTotal: number
  totalCubic: number
  paidTotal: number
  openingBalance: number
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
    location?: string
    openingBalance?: number
    openingBalanceDate?: string
  }) => Promise<
    | UseCaseResult<{
        id: number
        name: string
        initialPrice: number | null
        location: string | null
        openingBalance: number
        openingBalanceDate: string | null
      }>
    | FailedUseCaseResult
  >
  createCrusher: (input: {
    name: string
    initialPrice?: number
  }) => Promise<
    UseCaseResult<{ id: number; name: string; initialPrice: number | null }> | FailedUseCaseResult
  >
  createMaterialType: (input: {
    name: string
  }) => Promise<UseCaseResult<MaterialTypeRow> | FailedUseCaseResult>
  createContractor: (input: {
    name: string
    phone?: string
    openingBalance?: number
    openingBalanceDate?: string
  }) => Promise<
    | UseCaseResult<{
        id: number
        name: string
        phone: string | null
        openingBalance: number
        openingBalanceDate: string | null
      }>
    | FailedUseCaseResult
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
    notes?: string
  }) => Promise<UseCaseResult<{ id: string }> | FailedUseCaseResult>
  closeShift: (input: {
    shiftId: string
    endDate: string
    reportedTripCount: number
  }) => Promise<UseCaseResult<{ id: string; backupWarning?: true }> | FailedUseCaseResult>
  getBackupStatus: () => Promise<
    { lastSuccessAt: string | null; lastError: string | null } | FailedUseCaseResult
  >
  reopenShift: (input: {
    shiftId: string
    reason: string
  }) => Promise<UseCaseResult<{ id: string }> | FailedUseCaseResult>
  listDrivers: () => Promise<
    | UseCaseResult<{ id: number; name: string; phone1: string | null; phone2: string | null }[]>
    | FailedUseCaseResult
  >
  listContractors: () => Promise<
    | UseCaseResult<
        {
          id: number
          name: string
          phone: string | null
          openingBalance: number
          openingBalanceDate: string | null
        }[]
      >
    | FailedUseCaseResult
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
    location?: string
    openingBalance?: number
    openingBalanceDate?: string
  }) => Promise<
    | UseCaseResult<{
        id: number
        name: string
        initialPrice: number | null
        location: string | null
        openingBalance: number
        openingBalanceDate: string | null
      }>
    | FailedUseCaseResult
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
  updateMaterialType: (input: {
    id: number
    name: string
  }) => Promise<UseCaseResult<MaterialTypeRow> | FailedUseCaseResult>
  deleteMaterialType: (input: {
    id: number
  }) => Promise<UseCaseResult<{ id: number }> | FailedUseCaseResult>
  updateContractor: (input: {
    id: number
    name: string
    phone?: string
    openingBalance?: number
    openingBalanceDate?: string
  }) => Promise<
    | UseCaseResult<{
        id: number
        name: string
        phone: string | null
        openingBalance: number
        openingBalanceDate: string | null
      }>
    | FailedUseCaseResult
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
  createTrip: (
    input: CreateTripApiInput
  ) => Promise<UseCaseResult<{ id: string }> | FailedUseCaseResult>
  createDraftTrip: (
    input: CreateDraftTripInput
  ) => Promise<UseCaseResult<{ id: number }> | FailedUseCaseResult>
  updateDraftTrip: (
    input: UpdateDraftTripInput
  ) => Promise<UseCaseResult<{ id: number }> | FailedUseCaseResult>
  deleteDraftTrip: (input: {
    id: number
  }) => Promise<UseCaseResult<{ id: number }> | FailedUseCaseResult>
  listDraftTrips: () => Promise<UseCaseResult<DraftTripListRow[]> | FailedUseCaseResult>
  promoteDraftTrip: (
    input: { draftId: number; custody?: PromoteCustodyInput | null } & CreateTripInput
  ) => Promise<UseCaseResult<{ tripId: string; ledgerId: number | null }> | FailedUseCaseResult>
  getDashboard: () => Promise<UseCaseResult<{ openShifts: OpenShiftCard[] }> | FailedUseCaseResult>
  getSuggestedTripPrices: (input: {
    clientId: number
    crusherId: number
    materialTypeId?: number
    location?: string
  }) => Promise<UseCaseResult<SuggestedTripPrices> | FailedUseCaseResult>
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
  listMaterialTypes: () => Promise<UseCaseResult<MaterialTypeRow[]> | FailedUseCaseResult>
  listClients: () => Promise<
    | UseCaseResult<
        {
          id: number
          name: string
          initialPrice: number | null
          location: string | null
          openingBalance: number
          openingBalanceDate: string | null
        }[]
      >
    | FailedUseCaseResult
  >
  createLedgerEntry: (
    input: CompatibleCreateLedgerEntryInput
  ) => Promise<UseCaseResult<{ id: number }> | FailedUseCaseResult>
  updateLedgerEntry: (
    input: CompatibleUpdateLedgerEntryInput
  ) => Promise<UseCaseResult<{ id: number }> | FailedUseCaseResult>
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
  updateTrip: (
    input: CompatibleUpdateTripApiInput
  ) => Promise<UseCaseResult<{ id: string }> | FailedUseCaseResult>
  deleteTrip: (input: {
    id: string
  }) => Promise<UseCaseResult<{ id: string }> | FailedUseCaseResult>
  addAttachment: (
    input:
      | {
          entityType: 'TRIP' | 'SHIFT'
          entityId: string
          kind: 'CRUSHER_RECEIPT' | 'CLIENT_RECEIPT' | 'CLOSING_SHEET'
          imageBase64: string
        }
      | {
          entityType: 'LEDGER'
          entityId: string
          kind: 'TRANSFER_RECEIPT'
          imageBase64: string
        }
  ) => Promise<UseCaseResult<{ id: number; path: string }> | FailedUseCaseResult>
  removeAttachment: (input: {
    id: number
  }) => Promise<UseCaseResult<{ id: number }> | FailedUseCaseResult>
  listEntityAttachments(input: {
    entityType: 'LEDGER'
    entityId: string
  }): Promise<UseCaseResult<LedgerAttachmentRow[]> | FailedUseCaseResult>
  listEntityAttachments(input: {
    entityType: 'TRIP' | 'SHIFT'
    entityId: string
  }): Promise<UseCaseResult<AttachmentRow[]> | FailedUseCaseResult>
  getAttachmentPhoto: (input: {
    attachmentId: number
  }) => Promise<UseCaseResult<{ dataUri: string | null }> | FailedUseCaseResult>
  getClientAccount: (input: {
    clientId: number
  }) => Promise<UseCaseResult<ClientAccount> | FailedUseCaseResult>
  getClientStatement: (input: {
    clientId: number
  }) => Promise<UseCaseResult<Statement> | FailedUseCaseResult>
  getContractorStatement: (input: {
    contractorId: number
  }) => Promise<UseCaseResult<Statement> | FailedUseCaseResult>
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
    notes: string | null
  }) => Promise<UseCaseResult<{ id: number }> | FailedUseCaseResult>
  deleteClientPayment: (input: {
    id: number
  }) => Promise<UseCaseResult<{ id: number }> | FailedUseCaseResult>
}

declare global {
  interface Window {
    api: Api
  }
}
