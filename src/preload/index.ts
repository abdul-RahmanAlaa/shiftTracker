import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { CreateShiftInput } from '../main/use-cases/createShift'

const api = {
  createDriver: (input: { name: string; phone1?: string; phone2?: string }) =>
    ipcRenderer.invoke('driver:create', input),
  createClient: (input: { name: string; initialPrice?: number }) =>
    ipcRenderer.invoke('client:create', input),
  createCrusher: (input: { name: string; initialPrice?: number }) =>
    ipcRenderer.invoke('crusher:create', input),
  createContractor: (input: { name: string }) => ipcRenderer.invoke('contractor:create', input),
  createVehicle: (input: {
    vehicleNo: number
    trailerNo: number
    contractorId: number
    defaultCubic?: number
    ownerName?: string
  }) => ipcRenderer.invoke('vehicle:create', input),
  createShift: (input: CreateShiftInput) => ipcRenderer.invoke('shift:create', input),
  closeShift: (input: { shiftId: string; endDate: string }) =>
    ipcRenderer.invoke('shift:close', input),
  listDrivers: () => ipcRenderer.invoke('driver:list'),
  listContractors: () => ipcRenderer.invoke('contractor:list'),
  listVehicles: () => ipcRenderer.invoke('vehicle:list'),
  listOpenShifts: () => ipcRenderer.invoke('shift:listOpen'),
  updateDriver: (input: { id: number; name: string; phone1?: string; phone2?: string }) =>
    ipcRenderer.invoke('driver:update', input),
  deleteDriver: (input: { id: number }) => ipcRenderer.invoke('driver:delete', input),
  updateClient: (input: { id: number; name: string; initialPrice?: number }) =>
    ipcRenderer.invoke('client:update', input),
  deleteClient: (input: { id: number }) => ipcRenderer.invoke('client:delete', input),
  updateCrusher: (input: { id: number; name: string; initialPrice?: number }) =>
    ipcRenderer.invoke('crusher:update', input),
  deleteCrusher: (input: { id: number }) => ipcRenderer.invoke('crusher:delete', input),
  updateContractor: (input: { id: number; name: string }) =>
    ipcRenderer.invoke('contractor:update', input),
  deleteContractor: (input: { id: number }) => ipcRenderer.invoke('contractor:delete', input),
  updateVehicle: (input: {
    vehicleNo: number
    trailerNo: number
    contractorId: number
    defaultCubic?: number
    ownerName?: string
  }) => ipcRenderer.invoke('vehicle:update', input),
  deleteVehicle: (input: { vehicleNo: number }) => ipcRenderer.invoke('vehicle:delete', input),
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
  }) => ipcRenderer.invoke('trip:create', input),
  listTripsByShift: (input: { shiftId: string }) => ipcRenderer.invoke('trip:listByShift', input),
  listTripLocations: () => ipcRenderer.invoke('trip:listLocations'),
  listClients: () => ipcRenderer.invoke('client:list'),
  listCrushers: () => ipcRenderer.invoke('crusher:list'),
  getDriverOpenShift: (input: { driverId: number }) =>
    ipcRenderer.invoke('shift:getForDriver', input),
  createLedgerEntry: (input: {
    entryDate: string
    driverId?: number
    movementType: 'عهدة' | 'دفعة' | 'اخرى'
    amount: number
    shiftId?: string
    contractorId?: number
    notes?: string
  }) => ipcRenderer.invoke('ledger:create', input),
  listLedgerEntries: () => ipcRenderer.invoke('ledger:list'),
  getContractorAccount: (input: { contractorId: number }) =>
    ipcRenderer.invoke('account:contractor', input),
  getDriverHistory: (input: { driverId: number }) => ipcRenderer.invoke('account:driver', input),
  getClientAccount: (input: { clientId: number }) => ipcRenderer.invoke('account:client', input),
  createClientPayment: (input: {
    entryDate: string
    clientId: number
    amount: number
    notes?: string
  }) => ipcRenderer.invoke('client:payment:create', input),
  listShifts: () => ipcRenderer.invoke('shift:listAll'),
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
    crusherReceiptStatus: 'قيمة' | 'مفيش (متأكد)' | 'مش معروف'
    crusherReceiptNo?: number
    clientId: number
    transportPrice: number
    clientPrice: number
    recipientNameStatus?: 'قيمة' | 'مش واضح'
    recipientName?: string
    clientReceiptNo?: string
    notes?: string
  }) => ipcRenderer.invoke('trip:update', input),
  deleteTrip: (input: { id: string }) => ipcRenderer.invoke('trip:delete', input),
  saveTripPhoto: (input: { tripId: string; imageBase64: string }) =>
    ipcRenderer.invoke('trip:savePhoto', input),
  deleteTripPhoto: (input: { tripId: string }) => ipcRenderer.invoke('trip:deletePhoto', input),
  getTripPhoto: (input: { photoPath: string }) => ipcRenderer.invoke('trip:getPhoto', input),
  importCsvData: (input: { csvText: string }) => ipcRenderer.invoke('data:importCsv', input)
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
