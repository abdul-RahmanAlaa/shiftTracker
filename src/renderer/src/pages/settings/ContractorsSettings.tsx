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

  async function handleCreateContractor(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const result = await window.api.createContractor({ name: contractorName })
    addLog(
      result.ok
        ? `✅ مقاول: ${result.data?.name} (id: ${result.data?.id})`
        : `❌ مقاول: ${result.errors?.map((x) => x.message).join(', ')}`
    )
    if (result.ok) {
      setContractorName('')
      await loadContractors()
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>المقاولون</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleCreateContractor}>
          <Input
            value={contractorName}
            onChange={(e) => setContractorName(e.target.value)}
            placeholder="اسم المقاول"
          />
          <Button type="submit">إضافة</Button>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {contractors.map((contractor) => (
                  <TableRow key={contractor.id}>
                    <TableCell>{contractor.name}</TableCell>
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
