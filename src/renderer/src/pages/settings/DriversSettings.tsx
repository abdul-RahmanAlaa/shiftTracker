import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { AddLog } from '@/App'

export function DriversSettings({ addLog }: { addLog: AddLog }): React.JSX.Element {
  const [driverName, setDriverName] = useState('')
  const [drivers, setDrivers] = useState<{ id: number; name: string }[]>([])
  const [loading, setLoading] = useState(true)

  async function loadDrivers(): Promise<void> {
    setLoading(true)
    const result = await window.api.listDrivers()
    if (result.ok) setDrivers(result.data)
    setLoading(false)
  }

  useEffect(() => {
    void window.api.listDrivers().then((result) => {
      if (result.ok) setDrivers(result.data)
      setLoading(false)
    })
  }, [])

  async function handleCreateDriver(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const result = await window.api.createDriver({ name: driverName })
    addLog(
      result.ok
        ? `✅ سائق: ${result.data?.name} (id: ${result.data?.id})`
        : `❌ سائق: ${result.errors?.map((x) => x.message).join(', ')}`
    )
    if (result.ok) {
      setDriverName('')
      await loadDrivers()
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>السائقون</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleCreateDriver}>
          <Input
            value={driverName}
            onChange={(e) => setDriverName(e.target.value)}
            placeholder="اسم السائق"
          />
          <Button type="submit">إضافة</Button>
        </form>
        <div className="mt-6">
          {loading ? (
            <p className="text-sm text-muted-foreground">جاري التحميل...</p>
          ) : drivers.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا يوجد بيانات بعد</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drivers.map((driver) => (
                  <TableRow key={driver.id}>
                    <TableCell>{driver.name}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
