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
  listOpenShifts: () => ipcRenderer.invoke('shift:listOpen')
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
