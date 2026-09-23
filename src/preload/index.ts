import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { CreateShiftInput } from '../main/use-cases/createShift'

const api = {
  createDriver: (input: { name: string }) => ipcRenderer.invoke('driver:create', input),
  createClient: (input: { name: string }) => ipcRenderer.invoke('client:create', input),
  createCrusher: (input: { name: string }) => ipcRenderer.invoke('crusher:create', input),
  createContractor: (input: { name: string }) => ipcRenderer.invoke('contractor:create', input),
  createVehicle: (input: { vehicleNo: number; trailerNo?: number; contractorId: number }) =>
    ipcRenderer.invoke('vehicle:create', input),
  createShift: (input: CreateShiftInput) => ipcRenderer.invoke('shift:create', input),
  closeShift: (input: { shiftId: string; endDate: string }) =>
    ipcRenderer.invoke('shift:close', input),
  listDrivers: () => ipcRenderer.invoke('driver:list'),
  listContractors: () => ipcRenderer.invoke('contractor:list'),
  listVehicles: () => ipcRenderer.invoke('vehicle:list'),
  listOpenShifts: () => ipcRenderer.invoke('shift:listOpen'),
  updateDriver: (input: { id: number; name: string }) => ipcRenderer.invoke('driver:update', input),
  deleteDriver: (input: { id: number }) => ipcRenderer.invoke('driver:delete', input),
  updateClient: (input: { id: number; name: string }) => ipcRenderer.invoke('client:update', input),
  deleteClient: (input: { id: number }) => ipcRenderer.invoke('client:delete', input),
  updateCrusher: (input: { id: number; name: string }) =>
    ipcRenderer.invoke('crusher:update', input),
  deleteCrusher: (input: { id: number }) => ipcRenderer.invoke('crusher:delete', input),
  updateContractor: (input: { id: number; name: string }) =>
    ipcRenderer.invoke('contractor:update', input),
  deleteContractor: (input: { id: number }) => ipcRenderer.invoke('contractor:delete', input),
  updateVehicle: (input: { vehicleNo: number; trailerNo: number; contractorId: number }) =>
    ipcRenderer.invoke('vehicle:update', input),
  deleteVehicle: (input: { vehicleNo: number }) => ipcRenderer.invoke('vehicle:delete', input)
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
