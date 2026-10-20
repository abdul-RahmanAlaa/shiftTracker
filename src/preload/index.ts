import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { CreateShiftInput } from '../main/use-cases/createShift'
import type { CloseShiftInput, CloseShiftResult } from '../main/use-cases/closeShift'
interface FailedUseCaseResult {
  ok: false
  errors: { field: string; message: string }[]
}

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T | FailedUseCaseResult> {
  try {
    return await ipcRenderer.invoke(channel, ...args)
  } catch {
    return { ok: false, errors: [{ field: '_form', message: 'UNEXPECTED_ERROR' }] }
  }
}

const api = {
  createDriver: (input: { name: string; phone1?: string; phone2?: string }) =>
    invoke('driver:create', input),
  createClient: (input: {
    name: string
    initialPrice?: number
    location?: string
    openingBalance?: number
    openingBalanceDate?: string
  }) => invoke('client:create', input),
  createCrusher: (input: { name: string; initialPrice?: number }) =>
    invoke('crusher:create', input),
  createMaterialType: (input: { name: string }) => invoke('materialType:create', input),
  createContractor: (input: {
    name: string
    phone?: string
    openingBalance?: number
    openingBalanceDate?: string
  }) => invoke('contractor:create', input),
  createVehicle: (input: {
    vehicleNo: number
    trailerNo: number
    contractorId: number
    defaultCubic?: number
    ownerName?: string
  }) => invoke('vehicle:create', input),
  createShift: (input: CreateShiftInput) => invoke('shift:create', input),
  closeShift: (input: CloseShiftInput): Promise<CloseShiftResult> =>
    invoke<CloseShiftResult>('shift:close', input),
  getBackupStatus: () =>
    invoke<{ lastSuccessAt: string | null; lastError: string | null }>('backup:getStatus'),
  reopenShift: (input: { shiftId: string; reason: string }) => invoke('shift:reopen', input),
  listDrivers: () => invoke('driver:list'),
  listMaterialTypes: () => invoke('materialType:list'),
  listContractors: () => invoke('contractor:list'),
  listVehicles: () => invoke('vehicle:list'),
  updateDriver: (input: { id: number; name: string; phone1?: string; phone2?: string }) =>
    invoke('driver:update', input),
  deleteDriver: (input: { id: number }) => invoke('driver:delete', input),
  updateClient: (input: {
    id: number
    name: string
    initialPrice?: number
    location?: string
    openingBalance?: number
    openingBalanceDate?: string
  }) => invoke('client:update', input),
  deleteClient: (input: { id: number }) => invoke('client:delete', input),
  updateCrusher: (input: { id: number; name: string; initialPrice?: number }) =>
    invoke('crusher:update', input),
  deleteCrusher: (input: { id: number }) => invoke('crusher:delete', input),
  updateMaterialType: (input: { id: number; name: string }) => invoke('materialType:update', input),
  deleteMaterialType: (input: { id: number }) => invoke('materialType:delete', input),
  updateContractor: (input: {
    id: number
    name: string
    phone?: string
    openingBalance?: number
    openingBalanceDate?: string
  }) => invoke('contractor:update', input),
  deleteContractor: (input: { id: number }) => invoke('contractor:delete', input),
  updateVehicle: (input: {
    vehicleNo: number
    trailerNo: number
    contractorId: number
    defaultCubic?: number
    ownerName?: string
  }) => invoke('vehicle:update', input),
  deleteVehicle: (input: { vehicleNo: number }) => invoke('vehicle:delete', input),
  createTrip: (input: {
    shiftId: string
    tripDate: string
    crusherCubic: number
    clientCubicReported: number
    fineAmount?: number
    fineReason?: string
    location?: string
    crusherId: number
    stonePrice: number
    crusherReceiptStatus: 'PROVIDED' | 'CONFIRMED_MISSING' | 'UNKNOWN'
    crusherReceiptNo?: number
    clientId: number
    transportPrice: number
    clientPrice: number
    materialTypeId: number
    recipientNameStatus?: 'PROVIDED' | 'UNCLEAR'
    recipientName?: string
    clientReceiptNo?: string
    notes?: string
  }) => invoke('trip:create', input),
  getSuggestedTripPrices: (input: {
    clientId: number
    crusherId: number
    materialTypeId?: number
    location?: string
  }) => invoke('trip:suggestPrices', input),
  listTripsByShift: (input: { shiftId: string }) => invoke('trip:listByShift', input),
  listTripLocations: () => invoke('trip:listLocations'),
  listAllTrips: () => invoke('trip:listAll'),
  listClients: () => invoke('client:list'),
  listCrushers: () => invoke('crusher:list'),
  getDriverOpenShift: (input: { driverId: number }) => invoke('shift:getForDriver', input),
  createLedgerEntry: (input: {
    entryDate: string
    driverId?: number
    movementType: 'ADVANCE' | 'PAYMENT' | 'OTHER'
    amount: number
    shiftId?: string
    contractorId?: number
    notes?: string
  }) => invoke('ledger:create', input),
  updateLedgerEntry: (input: {
    id: number
    entryDate: string
    driverId: number | null
    movementType: 'ADVANCE' | 'PAYMENT' | 'OTHER'
    amount: number
    shiftId: string | null
    contractorId: number | null
    notes: string | null
  }) => invoke('ledger:update', input),
  deleteLedgerEntry: (input: { id: number }) => invoke('ledger:delete', input),
  listLedgerEntries: () => invoke('ledger:list'),
  getContractorAccount: (input: { contractorId: number }) => invoke('account:contractor', input),
  getDriverHistory: (input: { driverId: number }) => invoke('account:driver', input),
  getClientAccount: (input: { clientId: number }) => invoke('account:client', input),
  getClientStatement: (input: { clientId: number }) => invoke('statement:client', input),
  getContractorStatement: (input: { contractorId: number }) =>
    invoke('statement:contractor', input),
  createClientPayment: (input: {
    entryDate: string
    clientId: number
    amount: number
    notes?: string
  }) => invoke('client:payment:create', input),
  updateClientPayment: (input: {
    id: number
    entryDate: string
    clientId: number
    amount: number
    notes: string | null
  }) => invoke('client:payment:update', input),
  deleteClientPayment: (input: { id: number }) => invoke('client:payment:delete', input),
  listShifts: () => invoke('shift:listAll'),
  updateTrip: (input: {
    id: string
    tripDate: string
    crusherCubic: number
    clientCubicReported: number
    fineAmount?: number
    fineReason?: string
    location?: string
    crusherId: number
    stonePrice: number
    crusherReceiptStatus: 'PROVIDED' | 'CONFIRMED_MISSING' | 'UNKNOWN'
    crusherReceiptNo?: number
    clientId: number
    transportPrice: number
    clientPrice: number
    materialTypeId: number
    recipientNameStatus?: 'PROVIDED' | 'UNCLEAR'
    recipientName?: string
    clientReceiptNo?: string
    notes?: string
  }) => invoke('trip:update', input),
  deleteTrip: (input: { id: string }) => invoke('trip:delete', input),
  addAttachment: (input: {
    entityType: 'TRIP' | 'SHIFT'
    entityId: string
    kind: 'CRUSHER_RECEIPT' | 'CLIENT_RECEIPT' | 'CLOSING_SHEET'
    imageBase64: string
  }) => invoke('attachment:add', input),
  removeAttachment: (input: { id: number }) => invoke('attachment:remove', input),
  listEntityAttachments: (input: { entityType: 'TRIP' | 'SHIFT'; entityId: string }) =>
    invoke('attachment:list', input),
  getAttachmentPhoto: (input: { attachmentId: number }) => invoke('attachment:getPhoto', input)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
