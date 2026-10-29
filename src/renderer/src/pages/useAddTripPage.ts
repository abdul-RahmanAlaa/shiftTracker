import { useEffect, useRef, useState } from 'react'
import { ipcApi } from '@/lib/ipcErrors'
import { createLatestGuard } from '@/lib/latestGuard'
import type { OpenShift, ResourceState } from './tripFormSchema'

const emptyResources: ResourceState = {
  drivers: [],
  vehicles: [],
  crushers: [],
  clients: [],
  materialTypes: [],
  locations: []
}

export type AddTripPageState = {
  resources: ResourceState
  selectedDriverId: number | undefined
  openShift: OpenShift | null | undefined
  shiftTripCount: number
  checkingShift: boolean
  resourceLoading: boolean
  selectedDriverRef: React.RefObject<number | undefined>
  loadDriverShift: (driverId: number) => Promise<void>
  selectDriver: (value: string) => Promise<void>
}

export function useAddTripPage(onDriverSelected: (driverId: number) => void): AddTripPageState {
  const [resources, setResources] = useState<ResourceState>(emptyResources)
  const [selectedDriverId, setSelectedDriverId] = useState<number | undefined>(undefined)
  const [openShift, setOpenShift] = useState<OpenShift | null | undefined>(undefined)
  const [shiftTripCount, setShiftTripCount] = useState(0)
  const [checkingShift, setCheckingShift] = useState(false)
  const [resourceLoading, setResourceLoading] = useState(true)
  const selectedDriverRef = useRef<number | undefined>(undefined)
  const driverGuard = useRef(createLatestGuard())

  useEffect(() => {
    void Promise.all([
      ipcApi.listDrivers(),
      ipcApi.listVehicles(),
      ipcApi.listCrushers(),
      ipcApi.listClients(),
      ipcApi.listMaterialTypes(),
      ipcApi.listTripLocations()
    ])
      .then(([drivers, vehicles, crushers, clients, materialTypes, locations]) => {
        setResources({
          drivers: drivers.ok ? drivers.data : [],
          vehicles: vehicles.ok ? vehicles.data : [],
          crushers: crushers.ok ? crushers.data : [],
          clients: clients.ok ? clients.data : [],
          materialTypes: materialTypes.ok ? materialTypes.data : [],
          locations: locations.ok ? locations.data : []
        })
      })
      .finally(() => setResourceLoading(false))
  }, [])

  useEffect(() => () => driverGuard.current.cancel(), [])

  async function loadDriverShift(driverId: number): Promise<void> {
    const token = driverGuard.current.next()
    setCheckingShift(true)
    try {
      const result = await ipcApi.getDriverOpenShift({ driverId })
      if (!driverGuard.current.isLatest(token)) return
      if (result.ok && result.data) {
        setOpenShift(result.data)
        const trips = await ipcApi.listTripsByShift({ shiftId: result.data.id })
        if (!driverGuard.current.isLatest(token)) return
        setShiftTripCount(trips.ok ? trips.data.length : 0)
      } else {
        setOpenShift(null)
        setShiftTripCount(0)
      }
    } finally {
      if (driverGuard.current.isLatest(token)) setCheckingShift(false)
    }
  }

  async function selectDriver(value: string): Promise<void> {
    if (!value) {
      driverGuard.current.cancel()
      selectedDriverRef.current = undefined
      setSelectedDriverId(undefined)
      setOpenShift(undefined)
      setShiftTripCount(0)
      setCheckingShift(false)
      return
    }
    const driverId = Number(value)
    selectedDriverRef.current = driverId
    setSelectedDriverId(driverId)
    onDriverSelected(driverId)
    setOpenShift(null)
    await loadDriverShift(driverId)
  }

  return {
    resources,
    selectedDriverId,
    openShift,
    shiftTripCount,
    checkingShift,
    resourceLoading,
    selectedDriverRef,
    loadDriverShift,
    selectDriver
  }
}
