import { getDb } from '../db'
import { getOpenShiftCards, OpenShiftCard } from '../repository/dashboardRepository'
import { UseCaseResult } from '../useCaseUtils'

export function getDashboard(): UseCaseResult<{ openShifts: OpenShiftCard[] }> {
  return { ok: true, data: { openShifts: getOpenShiftCards(getDb()) } }
}
