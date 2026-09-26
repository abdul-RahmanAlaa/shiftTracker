import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { initDatabase } from './db'
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
import { listVehicles, listOpenShifts, getDriverOpenShift, listShifts } from './use-cases/listData'
import { createTrip, updateTrip, deleteTrip } from './use-cases/createTrip'
import { listTripsByShift, listTripLocations } from './use-cases/listTripData'
import { listAllTrips } from './use-cases/listAllTripsData'
import { createLedgerEntry } from './use-cases/createLedgerEntry'
import { listLedgerEntries } from './use-cases/listLedgerData'
import { getContractorAccount, getDriverHistory } from './use-cases/getAccounts'
import { createClientPayment } from './use-cases/createClientPayment'
import { getClientAccount } from './use-cases/getAccounts'
import { deleteTripPhoto, getTripPhoto, saveTripPhoto } from './use-cases/tripPhoto'
import { importCsvData } from './use-cases/importCsvData'

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

  ipcMain.handle('driver:create', (_event, input) => createDriver(input))
  ipcMain.handle('client:create', (_event, input) => createClient(input))
  ipcMain.handle('crusher:create', (_event, input) => createCrusher(input))
  ipcMain.handle('contractor:create', (_event, input) => createContractor(input))
  ipcMain.handle('vehicle:create', (_event, input) => createVehicle(input))
  ipcMain.handle('shift:create', (_event, input) => createShift(input))
  ipcMain.handle('shift:close', (_event, input) => closeShift(input))
  ipcMain.handle('driver:list', () => listDrivers())
  ipcMain.handle('contractor:list', () => listContractors())
  ipcMain.handle('vehicle:list', () => listVehicles())
  ipcMain.handle('shift:listOpen', () => listOpenShifts())
  ipcMain.handle('driver:update', (_event, input) => updateDriver(input))
  ipcMain.handle('driver:delete', (_event, input) => deleteDriver(input))
  ipcMain.handle('client:update', (_event, input) => updateClient(input))
  ipcMain.handle('client:delete', (_event, input) => deleteClient(input))
  ipcMain.handle('crusher:update', (_event, input) => updateCrusher(input))
  ipcMain.handle('crusher:delete', (_event, input) => deleteCrusher(input))
  ipcMain.handle('contractor:update', (_event, input) => updateContractor(input))
  ipcMain.handle('contractor:delete', (_event, input) => deleteContractor(input))
  ipcMain.handle('vehicle:update', (_event, input) => updateVehicle(input))
  ipcMain.handle('vehicle:delete', (_event, input) => deleteVehicle(input))
  ipcMain.handle('trip:create', (_event, input) => createTrip(input))
  ipcMain.handle('trip:listByShift', (_event, input) => listTripsByShift(input.shiftId))
  ipcMain.handle('trip:listLocations', () => listTripLocations())
  ipcMain.handle('trip:listAll', () => listAllTrips())
  ipcMain.handle('client:list', () => listClients())
  ipcMain.handle('crusher:list', () => listCrushers())
  ipcMain.handle('shift:getForDriver', (_event, input) => getDriverOpenShift(input.driverId))
  ipcMain.handle('ledger:create', (_event, input) => createLedgerEntry(input))
  ipcMain.handle('ledger:list', () => listLedgerEntries())
  ipcMain.handle('account:contractor', (_event, input) => getContractorAccount(input))
  ipcMain.handle('account:driver', (_event, input) => getDriverHistory(input))
  ipcMain.handle('client:payment:create', (_event, input) => createClientPayment(input))
  ipcMain.handle('account:client', (_event, input) => getClientAccount(input))
  ipcMain.handle('shift:listAll', () => listShifts())
  ipcMain.handle('trip:update', (_event, input) => updateTrip(input))
  ipcMain.handle('trip:delete', (_event, input) => deleteTrip(input))
  ipcMain.handle('trip:savePhoto', (_event, input) => saveTripPhoto(input))
  ipcMain.handle('trip:deletePhoto', (_event, input) => deleteTripPhoto(input))
  ipcMain.handle('trip:getPhoto', (_event, input) => getTripPhoto(input))
  ipcMain.handle('data:importCsv', (_event, input) => importCsvData(input))

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
