import { useEffect, useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { AccountCard, LedgerEntriesTable, type LedgerRow } from './AccountTables'

type Driver = { id: number; name: string }
const emptyValue = '__none__'

export function DriverHistoryPage(): React.JSX.Element {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [selectedDriverId, setSelectedDriverId] = useState<number>()
  const [history, setHistory] = useState<LedgerRow[]>([])

  useEffect(() => {
    void window.api.listDrivers().then((result) => {
      if (result.ok) setDrivers(result.data)
    })
  }, [])

  async function handleChange(value: string): Promise<void> {
    if (value === emptyValue) {
      setSelectedDriverId(undefined)
      setHistory([])
      return
    }
    const driverId = Number(value)
    setSelectedDriverId(driverId)
    const result = await window.api.getDriverHistory({ driverId })
    if (result.ok) {
      setHistory(result.data)
    } else {
      setHistory([])
    }
  }

  return (
    <AccountCard title="سجل السائق">
      <Select
        value={selectedDriverId ? String(selectedDriverId) : emptyValue}
        onValueChange={(value) => void handleChange(value)}
      >
        <SelectTrigger>
          <SelectValue placeholder="اختر السائق" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={emptyValue}>اختر السائق</SelectItem>
          {drivers.map((driver) => (
            <SelectItem key={driver.id} value={String(driver.id)}>
              {driver.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedDriverId ? (
        <LedgerEntriesTable entries={history} />
      ) : (
        <p className="text-sm text-muted-foreground">اختر سائق عشان تشوف الحساب</p>
      )}
    </AccountCard>
  )
}
