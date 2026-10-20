import { listLedger as listLedgerRepo, LedgerRow } from '../repository/ledgerRepository'
import { fromMinorUnits } from '../accounting'
import { UseCaseResult } from '../useCaseUtils'

type LedgerEntry = Omit<LedgerRow, 'amountMinor'> & { amount: number }

export function listLedgerEntries(): UseCaseResult<LedgerEntry[]> {
  return {
    ok: true,
    data: listLedgerRepo().map(({ amountMinor, ...row }) => ({
      ...row,
      amount: fromMinorUnits(amountMinor)
    }))
  }
}
