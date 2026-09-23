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

type Crusher = { id: number; name: string }

export function CrushersSettings({ addLog }: { addLog: AddLog }): React.JSX.Element {
  const [crusherName, setCrusherName] = useState('')
  const [crushers, setCrushers] = useState<Crusher[]>([])
  const [loading, setLoading] = useState(true)
  const [editingCrusherId, setEditingCrusherId] = useState<number | null>(null)

  async function loadCrushers(): Promise<void> {
    setLoading(true)
    const result = await window.api.listCrushers()
    if (result.ok) setCrushers(result.data)
    setLoading(false)
  }

  useEffect(() => {
    void window.api.listCrushers().then((result) => {
      if (result.ok) setCrushers(result.data)
      setLoading(false)
    })
  }, [])

  async function handleSaveCrusher(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const result = editingCrusherId
      ? await window.api.updateCrusher({ id: editingCrusherId, name: crusherName })
      : await window.api.createCrusher({ name: crusherName })
    addLog(
      result.ok
        ? editingCrusherId
          ? `✅ كسارة اتعدلت: ${result.data.name} (id: ${result.data.id})`
          : `✅ كسارة: ${result.data.name} (id: ${result.data.id})`
        : `❌ كسارة: ${result.errors.map((x) => x.message).join(', ')}`
    )
    if (result.ok) {
      setCrusherName('')
      setEditingCrusherId(null)
      await loadCrushers()
    }
  }

  function startEditingCrusher(crusher: Crusher): void {
    setEditingCrusherId(crusher.id)
    setCrusherName(crusher.name)
  }

  function cancelEditingCrusher(): void {
    setEditingCrusherId(null)
    setCrusherName('')
  }

  async function handleDeleteCrusher(crusher: Crusher): Promise<void> {
    if (!confirm(`متأكد إنك عايز تمسح الكسارة ${crusher.name}؟`)) return
    const result = await window.api.deleteCrusher({ id: crusher.id })
    addLog(
      result.ok
        ? `✅ كسارة اتمسحت: ${crusher.name} (id: ${crusher.id})`
        : `❌ مسح الكسارة: ${result.errors.map((x) => x.message).join(', ')}`
    )
    if (result.ok) {
      if (editingCrusherId === crusher.id) cancelEditingCrusher()
      await loadCrushers()
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>الكسارات</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSaveCrusher}>
          <Input
            value={crusherName}
            onChange={(event) => setCrusherName(event.target.value)}
            placeholder="اسم الكسارة"
          />
          <Button type="submit">{editingCrusherId ? 'حفظ التعديل' : 'إضافة'}</Button>
          {editingCrusherId && (
            <Button type="button" variant="outline" onClick={cancelEditingCrusher}>
              إلغاء
            </Button>
          )}
        </form>
        <div className="mt-6">
          {loading ? (
            <p className="text-sm text-muted-foreground">جاري التحميل...</p>
          ) : crushers.length === 0 ? (
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
                {crushers.map((crusher) => (
                  <TableRow key={crusher.id}>
                    <TableCell>{crusher.name}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => startEditingCrusher(crusher)}
                        >
                          تعديل
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => void handleDeleteCrusher(crusher)}
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
