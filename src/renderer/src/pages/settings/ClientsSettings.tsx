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

type Client = { id: number; name: string }

export function ClientsSettings({ addLog }: { addLog: AddLog }): React.JSX.Element {
  const [clientName, setClientName] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [editingClientId, setEditingClientId] = useState<number | null>(null)

  async function loadClients(): Promise<void> {
    setLoading(true)
    const result = await window.api.listClients()
    if (result.ok) setClients(result.data)
    setLoading(false)
  }

  useEffect(() => {
    void window.api.listClients().then((result) => {
      if (result.ok) setClients(result.data)
      setLoading(false)
    })
  }, [])

  async function handleSaveClient(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const result = editingClientId
      ? await window.api.updateClient({ id: editingClientId, name: clientName })
      : await window.api.createClient({ name: clientName })
    addLog(
      result.ok
        ? editingClientId
          ? `✅ عميل اتعدل: ${result.data.name} (id: ${result.data.id})`
          : `✅ عميل: ${result.data.name} (id: ${result.data.id})`
        : `❌ عميل: ${result.errors.map((x) => x.message).join(', ')}`
    )
    if (result.ok) {
      setClientName('')
      setEditingClientId(null)
      await loadClients()
    }
  }

  function startEditingClient(client: Client): void {
    setEditingClientId(client.id)
    setClientName(client.name)
  }

  function cancelEditingClient(): void {
    setEditingClientId(null)
    setClientName('')
  }

  async function handleDeleteClient(client: Client): Promise<void> {
    if (!confirm(`متأكد إنك عايز تمسح العميل ${client.name}؟`)) return
    const result = await window.api.deleteClient({ id: client.id })
    addLog(
      result.ok
        ? `✅ عميل اتمسح: ${client.name} (id: ${client.id})`
        : `❌ مسح العميل: ${result.errors.map((x) => x.message).join(', ')}`
    )
    if (result.ok) {
      if (editingClientId === client.id) cancelEditingClient()
      await loadClients()
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>العملاء</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSaveClient}>
          <Input
            value={clientName}
            onChange={(event) => setClientName(event.target.value)}
            placeholder="اسم العميل"
          />
          <Button type="submit">{editingClientId ? 'حفظ التعديل' : 'إضافة'}</Button>
          {editingClientId && (
            <Button type="button" variant="outline" onClick={cancelEditingClient}>
              إلغاء
            </Button>
          )}
        </form>
        <div className="mt-6">
          {loading ? (
            <p className="text-sm text-muted-foreground">جاري التحميل...</p>
          ) : clients.length === 0 ? (
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
                {clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>{client.name}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => startEditingClient(client)}
                        >
                          تعديل
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => void handleDeleteClient(client)}
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
