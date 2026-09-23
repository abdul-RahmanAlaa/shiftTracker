import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { AddLog } from '@/App'

export function ContractorsSettings({ addLog }: { addLog: AddLog }): React.JSX.Element {
  const [contractorName, setContractorName] = useState('')
  const [contractors, setContractors] = useState<{ id: number; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [editingContractorId, setEditingContractorId] = useState<number | null>(null)

  async function loadContractors(): Promise<void> {
    setLoading(true)
    const result = await window.api.listContractors()
    if (result.ok) setContractors(result.data)
    setLoading(false)
  }

  useEffect(() => {
    void window.api.listContractors().then((result) => {
      if (result.ok) setContractors(result.data)
      setLoading(false)
    })
  }, [])

  async function handleSaveContractor(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const result = editingContractorId
      ? await window.api.updateContractor({ id: editingContractorId, name: contractorName })
      : await window.api.createContractor({ name: contractorName })
    addLog(
      result.ok
        ? editingContractorId
          ? `✅ مقاول اتعدل: ${result.data.name} (id: ${result.data.id})`
          : `✅ مقاول: ${result.data.name} (id: ${result.data.id})`
        : `❌ مقاول: ${result.errors.map((x) => x.message).join(', ')}`
    )
    if (result.ok) {
      setContractorName('')
      setEditingContractorId(null)
      await loadContractors()
    }
  }

  function startEditingContractor(contractor: { id: number; name: string }): void {
    setEditingContractorId(contractor.id)
    setContractorName(contractor.name)
  }

  function cancelEditingContractor(): void {
    setEditingContractorId(null)
    setContractorName('')
  }

  async function handleDeleteContractor(contractor: { id: number; name: string }): Promise<void> {
    if (!confirm(`متأكد إنك عايز تمسح المقاول ${contractor.name}؟`)) return
    const result = await window.api.deleteContractor({ id: contractor.id })
    addLog(
      result.ok
        ? `✅ مقاول اتمسح: ${contractor.name} (id: ${contractor.id})`
        : `❌ مسح المقاول: ${result.errors.map((x) => x.message).join(', ')}`
    )
    if (result.ok) {
      if (editingContractorId === contractor.id) cancelEditingContractor()
      await loadContractors()
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>المقاولون</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSaveContractor}>
          <Input
            value={contractorName}
            onChange={(e) => setContractorName(e.target.value)}
            placeholder="اسم المقاول"
          />
          <Button type="submit">{editingContractorId ? 'حفظ التعديل' : 'إضافة'}</Button>
          {editingContractorId && (
            <Button type="button" variant="outline" onClick={cancelEditingContractor}>
              إلغاء
            </Button>
          )}
        </form>
        <div className="mt-6">
          {loading ? (
            <p className="text-sm text-muted-foreground">جاري التحميل...</p>
          ) : contractors.length === 0 ? (
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
                {contractors.map((contractor) => (
                  <TableRow key={contractor.id}>
                    <TableCell>{contractor.name}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => startEditingContractor(contractor)}
                        >
                          تعديل
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => void handleDeleteContractor(contractor)}
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
