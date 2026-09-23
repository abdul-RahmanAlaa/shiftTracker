import { useEffect, useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import type { AddLog } from '@/App'
import {
  AccountCard,
  AccountSummary,
  LedgerEntriesTable,
  type ContractorAccount
} from './AccountTables'

type Contractor = { id: number; name: string }
const emptyValue = '__none__'

export function ContractorAccountPage({ addLog }: { addLog: AddLog }): React.JSX.Element {
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [selectedContractorId, setSelectedContractorId] = useState<number>()
  const [account, setAccount] = useState<ContractorAccount | null>(null)

  useEffect(() => {
    void window.api.listContractors().then((result) => {
      if (result.ok) setContractors(result.data)
      else addLog(`❌ تحميل المقاولين: ${result.errors.map((x) => x.message).join(', ')}`)
    })
  }, [addLog])

  async function handleChange(value: string): Promise<void> {
    if (value === emptyValue) {
      setSelectedContractorId(undefined)
      setAccount(null)
      return
    }
    const contractorId = Number(value)
    setSelectedContractorId(contractorId)
    const result = await window.api.getContractorAccount({ contractorId })
    if (result.ok) {
      setAccount(result.data)
      addLog(`✅ حساب المقاول اتعرض: ${contractorId}`)
    } else {
      setAccount(null)
      addLog(`❌ حساب المقاول: ${result.errors.map((x) => x.message).join(', ')}`)
    }
  }

  return (
    <AccountCard title="حساب المقاول">
      <Select
        value={selectedContractorId ? String(selectedContractorId) : emptyValue}
        onValueChange={(value) => void handleChange(value)}
      >
        <SelectTrigger>
          <SelectValue placeholder="اختر المقاول" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={emptyValue}>اختر المقاول</SelectItem>
          {contractors.map((contractor) => (
            <SelectItem key={contractor.id} value={String(contractor.id)}>
              {contractor.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedContractorId && account ? (
        <>
          <AccountSummary
            items={[
              { label: 'مستحق النقل', value: account.transportTotal },
              { label: 'إجمالي حركات السجل', value: account.ledgerTotal },
              { label: 'الرصيد', value: account.balance, highlight: true }
            ]}
          />
          <LedgerEntriesTable entries={account.entries} />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">اختر مقاول عشان تشوف الحساب</p>
      )}
    </AccountCard>
  )
}
