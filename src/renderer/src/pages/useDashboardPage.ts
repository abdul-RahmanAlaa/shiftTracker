import { useCallback, useEffect, useRef, useState } from 'react'
import type { DraftTripListRow, OpenShiftCard } from '../../../preload/index.d'
import { ipcApi } from '@/lib/ipcErrors'

export interface DashboardData {
  openShifts: OpenShiftCard[]
  drafts: DraftTripListRow[]
}

export function useDashboardPage(): {
  data: DashboardData
  loading: boolean
  refresh: () => void
} {
  const [data, setData] = useState<DashboardData>({ openShifts: [], drafts: [] })
  const [loading, setLoading] = useState(true)
  const requestId = useRef(0)

  const loadData = useCallback((currentRequestId: number) => {
    void Promise.all([ipcApi.getDashboard(), ipcApi.listDraftTrips()])
      .then(([dashboardResult, draftsResult]) => {
        if (requestId.current !== currentRequestId) return
        setData((current) => ({
          openShifts: dashboardResult.ok ? dashboardResult.data.openShifts : current.openShifts,
          drafts: draftsResult.ok ? draftsResult.data : current.drafts
        }))
      })
      .finally(() => {
        if (requestId.current === currentRequestId) setLoading(false)
      })
  }, [])

  const refresh = useCallback(() => {
    const currentRequestId = ++requestId.current
    setLoading(true)
    loadData(currentRequestId)
  }, [loadData])

  useEffect(() => {
    const currentRequestId = ++requestId.current
    loadData(currentRequestId)
    return () => {
      requestId.current += 1
    }
  }, [loadData])

  return { data, loading, refresh }
}
