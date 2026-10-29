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
import {
  AccountCard,
  AccountSummary,
  LedgerEntriesTable,
  type ContractorAccount
} from './AccountTables'

type Contractor = { id: number; name: string }
type Driver = { id: number; name: string }
type Shift = { id: string; status: string }
const emptyValue = '__none__'

export function ContractorAccountPage(): React.JSX.Element {
  const { t } = useTranslation()
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [selectedContractorId, setSelectedContractorId] = useState<number>()
  const [accountReloadVersion, setAccountReloadVersion] = useState(0)
  const [account, setAccount] = useState<ContractorAccount | null>(null)
  const accountLoadGuard = useRef(createLatestGuard())
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

  const loadAccount = useCallback(async (contractorId: number): Promise<void> => {
    const token = accountLoadGuard.current.next()
    const result = await ipcApi.getContractorAccount({ contractorId })
    if (!accountLoadGuard.current.isLatest(token)) return
    if (result.ok) {
      setAccount(result.data)
    } else {
      setAccount(null)
    }
  }, [])

  useEffect(() => {
    void Promise.all([ipcApi.listContractors(), ipcApi.listDrivers(), ipcApi.listShifts()]).then(
      ([contractorsResult, driversResult, shiftsResult]) => {
        if (contractorsResult.ok) setContractors(contractorsResult.data)
        if (driversResult.ok) setDrivers(driversResult.data)
        if (shiftsResult.ok) setShifts(shiftsResult.data)
      }
    )
  }, [])

  useEffect(() => () => accountLoadGuard.current.cancel(), [])

  useEffect(() => {
    if (selectedContractorId === undefined) return
    accountLoadGuard.current.cancel()
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) void loadAccount(selectedContractorId)
    })
    return () => {
      cancelled = true
    }
  }, [accountReloadVersion, loadAccount, selectedContractorId])

  async function handleChange(value: string): Promise<void> {
    if (value === emptyValue) {
      accountLoadGuard.current.cancel()
      setSelectedContractorId(undefined)
      setAccount(null)
      return
    }
    const contractorId = Number(value)
    accountLoadGuard.current.cancel()
    setSelectedContractorId(contractorId)
  }

  function getDefaultLedgerValues(contractorId?: number): LedgerEntryFormValues {
    return {
      entryDate: '',
      driverId: undefined,
      movementType: 'ADVANCE',
      amount: 0,
      shiftId: undefined,
      contractorId,
      notes: ''
    }
  }

  const ledgerMutations = useLedgerEntryMutations({
    form: ledgerForm,
    getDefaultValues: () => getDefaultLedgerValues(),
    getCreateValues: () => getDefaultLedgerValues(selectedContractorId),
    onRefresh: () => setAccountReloadVersion((version) => version + 1),
    shifts
  })

  return (
    <AccountCard title={t('contractorAccount.title')}>
      <Select
        value={selectedContractorId ? String(selectedContractorId) : emptyValue}
        onValueChange={(value) => void handleChange(value)}
      >
        <SelectTrigger>
          <SelectValue placeholder={t('ledgerEntryForm.placeholders.contractor')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={emptyValue}>{t('ledgerEntryForm.placeholders.contractor')}</SelectItem>
          {contractors.map((contractor) => (
            <SelectItem key={contractor.id} value={String(contractor.id)}>
              {contractor.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedContractorId && account ? (
        <>
          <p className="text-sm text-muted-foreground">{t('contractorAccount.balanceSignNote')}</p>
          <AccountSummary
            items={[
              {
                label: t('contractorAccount.summary.transportDue'),
                value: account.transportTotal,
                format: 'money'
              },
              {
                label: t('contractorAccount.summary.materialDue'),
                value: account.materialTotal,
                format: 'money'
              },
              {
                label: t('contractorAccount.summary.openingBalance'),
                value: account.openingBalance,
                format: 'money'
              },
              {
                label: t('contractorAccount.summary.ledgerTotal'),
                value: account.ledgerTotal,
                format: 'money'
              },
              {
                label: t('contractorAccount.summary.balance'),
                value: account.balance,
                format: 'money',
                highlight: true
              }
            ]}
          />
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
            lockedContractorId={!ledgerMutations.editingEntry ? selectedContractorId : undefined}
          />
          <LedgerEntriesTable
            entries={account.entries}
            onEditEntry={ledgerMutations.openEditEntryDialog}
            onDeleteEntry={ledgerMutations.handleDeleteEntry}
            getIsEntryLocked={ledgerMutations.isEntryLocked}
          />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t('contractorAccount.selectContractorHint')}
        </p>
      )}
    </AccountCard>
  )
}
