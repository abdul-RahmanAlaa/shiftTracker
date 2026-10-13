import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { initDatabase } from './db'
import { wrapHandler } from './ipcWrapper'
import {
  createContractor,
  listContractors,
  updateContractor,
  deleteContractor
} from './use-cases/createContractor'
import { createDriver, listDrivers, updateDriver, deleteDriver } from './use-cases/createDriver'
import { createClient, listClients, updateClient, deleteClient } from './use-cases/createClient'
import {
  createCrusher,
  listCrushers,
  updateCrusher,
  deleteCrusher
} from './use-cases/createCrusher'
import { createVehicle, updateVehicle, deleteVehicle } from './use-cases/createVehicle'
import { createShift } from './use-cases/createShift'
import { closeShift } from './use-cases/closeShift'
import { reopenShift } from './use-cases/reopenShift'
import { listVehicles, listOpenShifts, getDriverOpenShift, listShifts } from './use-cases/listData'
import { createTrip, updateTrip, deleteTrip } from './use-cases/createTrip'
import { listTripsByShift, listTripLocations } from './use-cases/listTripData'
import { listAllTrips } from './use-cases/listAllTripsData'
import {
  createLedgerEntry,
  updateLedgerEntry,
  deleteLedgerEntry
} from './use-cases/createLedgerEntry'
import { listLedgerEntries } from './use-cases/listLedgerData'
import { getContractorAccount, getDriverHistory } from './use-cases/getAccounts'
import {
  createClientPayment,
  updateClientPayment,
  deleteClientPayment
} from './use-cases/createClientPayment'
import { getClientAccount } from './use-cases/getAccounts'
import {
  addAttachment,
  removeAttachment,
  listEntityAttachments,
  getAttachmentPhoto
} from './use-cases/attachmentPhoto'
import {
  createMaterialType,
  listMaterialTypes,
  updateMaterialType,
  deleteMaterialType
} from './use-cases/createMaterialType'
import { getClientStatement, getContractorStatement } from './use-cases/getStatement'

function registerIpcHandler(channel: string, handler: Parameters<typeof ipcMain.handle>[1]): void {
  ipcMain.handle(channel, wrapHandler(handler))
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  initDatabase()

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  registerIpcHandler('driver:create', (_event, input) => createDriver(input))
  registerIpcHandler('client:create', (_event, input) => createClient(input))
  registerIpcHandler('crusher:create', (_event, input) => createCrusher(input))
  registerIpcHandler('contractor:create', (_event, input) => createContractor(input))
  registerIpcHandler('vehicle:create', (_event, input) => createVehicle(input))
  registerIpcHandler('shift:create', (_event, input) => createShift(input))
  registerIpcHandler('shift:close', (_event, input) => closeShift(input))
  registerIpcHandler('shift:reopen', (_event, input) => reopenShift(input))
  registerIpcHandler('driver:list', () => listDrivers())
  registerIpcHandler('contractor:list', () => listContractors())
  registerIpcHandler('vehicle:list', () => listVehicles())
  registerIpcHandler('shift:listOpen', () => listOpenShifts())
  registerIpcHandler('driver:update', (_event, input) => updateDriver(input))
  registerIpcHandler('driver:delete', (_event, input) => deleteDriver(input))
  registerIpcHandler('client:update', (_event, input) => updateClient(input))
  registerIpcHandler('client:delete', (_event, input) => deleteClient(input))
  registerIpcHandler('crusher:update', (_event, input) => updateCrusher(input))
  registerIpcHandler('crusher:delete', (_event, input) => deleteCrusher(input))
  registerIpcHandler('contractor:update', (_event, input) => updateContractor(input))
  registerIpcHandler('contractor:delete', (_event, input) => deleteContractor(input))
  registerIpcHandler('materialType:create', (_event, input) => createMaterialType(input))
  registerIpcHandler('materialType:list', () => listMaterialTypes())
  registerIpcHandler('materialType:update', (_event, input) => updateMaterialType(input))
  registerIpcHandler('materialType:delete', (_event, input) => deleteMaterialType(input))
  registerIpcHandler('vehicle:update', (_event, input) => updateVehicle(input))
  registerIpcHandler('vehicle:delete', (_event, input) => deleteVehicle(input))
  registerIpcHandler('trip:create', (_event, input) => createTrip(input))
  registerIpcHandler('trip:listByShift', (_event, input) => listTripsByShift(input.shiftId))
  registerIpcHandler('trip:listLocations', () => listTripLocations())
  registerIpcHandler('trip:listAll', () => listAllTrips())
  registerIpcHandler('client:list', () => listClients())
  registerIpcHandler('crusher:list', () => listCrushers())
  registerIpcHandler('shift:getForDriver', (_event, input) => getDriverOpenShift(input.driverId))
  registerIpcHandler('ledger:create', (_event, input) => createLedgerEntry(input))
  registerIpcHandler('ledger:update', (_event, input) => updateLedgerEntry(input))
  registerIpcHandler('ledger:delete', (_event, input) => deleteLedgerEntry(input))
  registerIpcHandler('ledger:list', () => listLedgerEntries())
  registerIpcHandler('account:contractor', (_event, input) => getContractorAccount(input))
  registerIpcHandler('account:driver', (_event, input) => getDriverHistory(input))
  registerIpcHandler('statement:client', (_event, input) => getClientStatement(input))
  registerIpcHandler('statement:contractor', (_event, input) => getContractorStatement(input))
  registerIpcHandler('client:payment:create', (_event, input) => createClientPayment(input))
  registerIpcHandler('client:payment:update', (_event, input) => updateClientPayment(input))
  registerIpcHandler('client:payment:delete', (_event, input) => deleteClientPayment(input))
  registerIpcHandler('account:client', (_event, input) => getClientAccount(input))
  registerIpcHandler('shift:listAll', () => listShifts())
  registerIpcHandler('trip:update', (_event, input) => updateTrip(input))
  registerIpcHandler('trip:delete', (_event, input) => deleteTrip(input))
  registerIpcHandler('attachment:add', (_event, input) => addAttachment(input))
  registerIpcHandler('attachment:remove', (_event, input) => removeAttachment(input))
  registerIpcHandler('attachment:list', (_event, input) => listEntityAttachments(input))
  registerIpcHandler('attachment:getPhoto', (_event, input) => getAttachmentPhoto(input))

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
