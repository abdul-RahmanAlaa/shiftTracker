import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import type { AddLog } from '@/App'

export function DriversSettings({ addLog }: { addLog: AddLog }): React.JSX.Element {
  const [driverName, setDriverName] = useState('')
  const [drivers, setDrivers] = useState<{ id: number; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [editingDriverId, setEditingDriverId] = useState<number | null>(null)

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

  async function handleSaveDriver(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const result = editingDriverId
      ? await window.api.updateDriver({ id: editingDriverId, name: driverName })
      : await window.api.createDriver({ name: driverName })
    addLog(
      result.ok
        ? editingDriverId
          ? `✅ سائق اتعدل: ${result.data.name} (id: ${result.data.id})`
          : `✅ سائق: ${result.data.name} (id: ${result.data.id})`
        : `❌ سائق: ${result.errors.map((x) => x.message).join(', ')}`
    )
    if (result.ok) {
      setDriverName('')
      setEditingDriverId(null)
      await loadDrivers()
    }
  }

  function startEditingDriver(driver: { id: number; name: string }): void {
    setEditingDriverId(driver.id)
    setDriverName(driver.name)
  }

  function cancelEditingDriver(): void {
    setEditingDriverId(null)
    setDriverName('')
  }

  async function handleDeleteDriver(driver: { id: number; name: string }): Promise<void> {
    if (!confirm(`متأكد إنك عايز تمسح السائق ${driver.name}؟`)) return
    const result = await window.api.deleteDriver({ id: driver.id })
    addLog(
      result.ok
        ? `✅ سائق اتمسح: ${driver.name} (id: ${driver.id})`
        : `❌ مسح السائق: ${result.errors.map((x) => x.message).join(', ')}`
    )
    if (result.ok) {
      if (editingDriverId === driver.id) cancelEditingDriver()
      await loadDrivers()
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>السائقون</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSaveDriver}>
          <Input
            value={driverName}
            onChange={(e) => setDriverName(e.target.value)}
            placeholder="اسم السائق"
          />
          <Button type="submit">{editingDriverId ? 'حفظ التعديل' : 'إضافة'}</Button>
          {editingDriverId && (
            <Button type="button" variant="outline" onClick={cancelEditingDriver}>
              إلغاء
            </Button>
          )}
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
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drivers.map((driver) => (
                  <TableRow key={driver.id}>
                    <TableCell>{driver.name}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => startEditingDriver(driver)}
                        >
                          تعديل
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => void handleDeleteDriver(driver)}
                        >
                          مسح
                        </Button>
                      </div>
                    </TableCell>
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
