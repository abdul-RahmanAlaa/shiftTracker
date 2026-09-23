import { listLedger as listLedgerRepo, LedgerRow } from '../repository/ledgerRepository'

type UseCaseResult<T> =
  { ok: true; data: T } | { ok: false; errors: { field: string; message: string }[] }

export function listLedgerEntries(): UseCaseResult<LedgerRow[]> {
  return { ok: true, data: listLedgerRepo() }
}
