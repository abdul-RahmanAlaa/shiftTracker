import { useEffect, useState } from 'react'
import { ipcApi } from '@/lib/ipcErrors'

export type ShiftListRow = Extract<
  Awaited<ReturnType<typeof ipcApi.listShifts>>,
  { ok: true }
>['data'][number]
export type AttachmentRow = Extract<
  Awaited<ReturnType<typeof ipcApi.listEntityAttachments>>,
  { ok: true }
>['data'][number]
export type CloseShiftValues = { shiftId: string; endDate: string; reportedTripCount: number }
export type ReopenShiftValues = { shiftId: string; reason: string }

export type ShiftsPageData = {
  shifts: ShiftListRow[]
  drivers: { id: number; name: string }[]
  vehicles: { vehicleNo: number; trailerNo: number; contractorId: number }[]
  loading: boolean
  closingAttachments: AttachmentRow[]
  tripsMissingAttachments: string[]
  loadedCloseRequirementsShiftId: string | null
  loadShifts: () => Promise<void>
  refreshCloseRequirements: () => void
  clearCloseRequirements: () => void
}

export function useShiftsPageData(closeShiftId: string): ShiftsPageData {
  const [shifts, setShifts] = useState<ShiftListRow[]>([])
  const [drivers, setDrivers] = useState<{ id: number; name: string }[]>([])
  const [vehicles, setVehicles] = useState<
    { vehicleNo: number; trailerNo: number; contractorId: number }[]
  >([])
  const [loading, setLoading] = useState(true)
  const [closingAttachments, setClosingAttachments] = useState<AttachmentRow[]>([])
  const [tripsMissingAttachments, setTripsMissingAttachments] = useState<string[]>([])
  const [loadedCloseRequirementsShiftId, setLoadedCloseRequirementsShiftId] = useState<
    string | null
  >(null)
  const [attachmentRefreshVersion, setAttachmentRefreshVersion] = useState(0)

  useEffect(() => {
    void Promise.all([ipcApi.listShifts(), ipcApi.listDrivers(), ipcApi.listVehicles()])
      .then(([shiftResult, driversResult, vehiclesResult]) => {
        if (shiftResult.ok) setShifts(shiftResult.data)
        if (driversResult.ok) setDrivers(driversResult.data)
        if (vehiclesResult.ok) setVehicles(vehiclesResult.data)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!closeShiftId) return

    let cancelled = false
    void (async () => {
      const [shiftAttachmentsResult, tripsResult] = await Promise.all([
        ipcApi.listEntityAttachments({ entityType: 'SHIFT', entityId: closeShiftId }),
        ipcApi.listTripsByShift({ shiftId: closeShiftId })
      ])

      if (cancelled) return
      setClosingAttachments(
        shiftAttachmentsResult.ok
          ? shiftAttachmentsResult.data.filter((attachment) => attachment.kind === 'CLOSING_SHEET')
          : []
      )

      if (tripsResult.ok) {
        const attachmentResults = await Promise.all(
          tripsResult.data.map((trip) =>
            ipcApi.listEntityAttachments({ entityType: 'TRIP', entityId: trip.id })
          )
        )

        if (cancelled) return
        setTripsMissingAttachments(
          tripsResult.data
            .filter((_, index) => {
              const result = attachmentResults[index]
              return !result.ok || result.data.length === 0
            })
            .map((trip) => trip.id)
        )
      } else {
        setTripsMissingAttachments([])
      }

      setLoadedCloseRequirementsShiftId(closeShiftId)
    })()

    return () => {
      cancelled = true
    }
  }, [closeShiftId, attachmentRefreshVersion])

  async function loadShifts(): Promise<void> {
    const result = await ipcApi.listShifts()
    if (result.ok) setShifts(result.data)
  }

  function refreshCloseRequirements(): void {
    setLoadedCloseRequirementsShiftId(null)
    setAttachmentRefreshVersion((previous) => previous + 1)
  }

  function clearCloseRequirements(): void {
    setClosingAttachments([])
    setTripsMissingAttachments([])
    setLoadedCloseRequirementsShiftId(null)
  }

  return {
    shifts,
    drivers,
    vehicles,
    loading,
    closingAttachments,
    tripsMissingAttachments,
    loadedCloseRequirementsShiftId,
    loadShifts,
    refreshCloseRequirements,
    clearCloseRequirements
  }
}
