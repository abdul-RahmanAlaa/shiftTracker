import { ipcApi } from '@/lib/ipcErrors'
import { createLatestGuard } from '@/lib/latestGuard'
import { useCallback, useEffect, useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { LedgerEntryDialog } from '@/components/LedgerEntryDialog'
import { ledgerEntrySchema, type LedgerEntryFormValues } from '@/components/LedgerEntryForm'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useLedgerEntryMutations } from './useLedgerEntryMutations'
import { AccountCard, LedgerEntriesTable, type LedgerRow } from './AccountTables'

type Driver = { id: number; name: string }
type Contractor = { id: number; name: string }
type Shift = { id: string; status: string }
const emptyValue = '__none__'

export function DriverHistoryPage(): React.JSX.Element {
  const { t } = useTranslation()
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [selectedDriverId, setSelectedDriverId] = useState<number>()
  const [historyReloadVersion, setHistoryReloadVersion] = useState(0)
  const [history, setHistory] = useState<LedgerRow[]>([])
  const historyLoadGuard = useRef(createLatestGuard())
  const [shifts, setShifts] = useState<Shift[]>([])
  const ledgerForm = useForm<LedgerEntryFormValues>({
    resolver: zodResolver(ledgerEntrySchema),
    defaultValues: {
      entryDate: '',
      driverId: undefined,
      movementType: 'ADVANCE',
      amount: 0,
      shiftId: undefined,
      contractorId: undefined,
      notes: ''
    } as LedgerEntryFormValues
  })

  const loadHistory = useCallback(async (driverId: number): Promise<void> => {
    const token = historyLoadGuard.current.next()
    const result = await ipcApi.getDriverHistory({ driverId })
    if (!historyLoadGuard.current.isLatest(token)) return
    if (result.ok) {
      setHistory(result.data)
    } else {
      setHistory([])
    }
  }, [])

  useEffect(() => {
    void Promise.all([ipcApi.listDrivers(), ipcApi.listContractors(), ipcApi.listShifts()]).then(
      ([driversResult, contractorsResult, shiftsResult]) => {
        if (driversResult.ok) setDrivers(driversResult.data)
        if (contractorsResult.ok) setContractors(contractorsResult.data)
        if (shiftsResult.ok) setShifts(shiftsResult.data)
      }
    )
  }, [])

  useEffect(() => () => historyLoadGuard.current.cancel(), [])

  useEffect(() => {
    if (selectedDriverId === undefined) return
    historyLoadGuard.current.cancel()
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) void loadHistory(selectedDriverId)
    })
    return () => {
      cancelled = true
    }
  }, [historyReloadVersion, loadHistory, selectedDriverId])

  async function handleChange(value: string): Promise<void> {
    if (value === emptyValue) {
      historyLoadGuard.current.cancel()
      setSelectedDriverId(undefined)
      setHistory([])
      return
    }
    const driverId = Number(value)
    historyLoadGuard.current.cancel()
    setSelectedDriverId(driverId)
  }

  function getDefaultLedgerValues(driverId?: number): LedgerEntryFormValues {
    return {
      entryDate: '',
      driverId,
      movementType: 'ADVANCE',
      amount: 0,
      shiftId: undefined,
      contractorId: undefined,
      notes: ''
    }
  }

  const ledgerMutations = useLedgerEntryMutations({
    form: ledgerForm,
    getDefaultValues: () => getDefaultLedgerValues(),
    getCreateValues: () => getDefaultLedgerValues(selectedDriverId),
    onRefresh: () => setHistoryReloadVersion((version) => version + 1),
    shifts
  })

  return (
    <AccountCard title={t('driverHistory.title')}>
      <Select
        value={selectedDriverId ? String(selectedDriverId) : emptyValue}
        onValueChange={(value) => void handleChange(value)}
      >
        <SelectTrigger>
          <SelectValue placeholder={t('driverHistory.selectDriver')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={emptyValue}>{t('driverHistory.selectDriver')}</SelectItem>
          {drivers.map((driver) => (
            <SelectItem key={driver.id} value={String(driver.id)}>
              {driver.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedDriverId ? (
        <>
          <div className="flex justify-end">
            <LedgerEntryDialog
              trigger={
                <Button type="button" onClick={ledgerMutations.openCreateEntryDialog}>
                  {t('allMovements.addMovement')}
                </Button>
              }
              open={ledgerMutations.isDialogOpen}
              onOpenChange={ledgerMutations.onDialogOpenChange}
              editingEntry={ledgerMutations.editingEntry}
              form={ledgerForm}
              onSubmit={ledgerMutations.handleSaveEntry}
              drivers={drivers}
              contractors={contractors}
              shifts={shifts}
              lockedDriverId={!ledgerMutations.editingEntry ? selectedDriverId : undefined}
              requireContractorId={!ledgerMutations.editingEntry}
            />
          </div>
          <LedgerEntriesTable
            entries={history}
            onEditEntry={ledgerMutations.openEditEntryDialog}
            onDeleteEntry={ledgerMutations.handleDeleteEntry}
            getIsEntryLocked={ledgerMutations.isEntryLocked}
          />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{t('driverHistory.selectDriverHint')}</p>
      )}
    </AccountCard>
  )
}
