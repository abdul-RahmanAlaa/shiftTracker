import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/DataTable'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

const contractorSchema = z.object({
  name: z.string().min(1, 'اسم المقاول مطلوب')
})

type ContractorFormValues = z.infer<typeof contractorSchema>
type Contractor = { id: number; name: string }

export function ContractorsSettings(): React.JSX.Element {
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [loading, setLoading] = useState(true)
  const [editingContractorId, setEditingContractorId] = useState<number | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const contractorForm = useForm<ContractorFormValues>({
    resolver: zodResolver(contractorSchema),
    defaultValues: { name: '' }
  })

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

  async function handleSaveContractor(values: ContractorFormValues): Promise<void> {
    const result = editingContractorId
      ? await window.api.updateContractor({ id: editingContractorId, ...values })
      : await window.api.createContractor(values)
    if (result.ok) {
      setIsDialogOpen(false)
      contractorForm.reset()
      setEditingContractorId(null)
      await loadContractors()
    } else {
      result.errors.forEach((error) => {
        if (error.field === 'name') {
          contractorForm.setError(error.field, { message: error.message })
        }
      })
    }
  }

  function startEditingContractor(contractor: Contractor): void {
    setEditingContractorId(contractor.id)
    contractorForm.reset({ name: contractor.name })
    setIsDialogOpen(true)
  }

  function cancelEditingContractor(): void {
    setEditingContractorId(null)
    contractorForm.reset()
    setIsDialogOpen(false)
  }

  async function handleDeleteContractor(contractor: Contractor): Promise<void> {
    if (!confirm(`متأكد إنك عايز تمسح المقاول ${contractor.name}؟`)) return
    const result = await window.api.deleteContractor({ id: contractor.id })
    if (result.ok) {
      if (editingContractorId === contractor.id) cancelEditingContractor()
      await loadContractors()
    }
  }

  function handleDialogChange(open: boolean): void {
    setIsDialogOpen(open)
    if (!open) {
      setEditingContractorId(null)
      contractorForm.reset()
    }
  }

  const columns: ColumnDef<Contractor, unknown>[] = [
    { accessorKey: 'name', header: 'الاسم' },
    {
      id: 'actions',
      header: 'إجراءات',
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => startEditingContractor(row.original)}
          >
            تعديل
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => void handleDeleteContractor(row.original)}
          >
            مسح
          </Button>
        </div>
      )
    }
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>المقاولون</CardTitle>
      </CardHeader>
      <CardContent>
        <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button
              type="button"
              onClick={() => {
                setEditingContractorId(null)
                contractorForm.reset()
              }}
            >
              إضافة مقاول
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingContractorId ? 'تعديل مقاول' : 'إضافة مقاول جديد'}</DialogTitle>
            </DialogHeader>
            <Form {...contractorForm}>
              <form
                onSubmit={contractorForm.handleSubmit(handleSaveContractor)}
                className="grid gap-4"
              >
                <FormField
                  control={contractorForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>اسم المقاول</FormLabel>
                      <FormControl>
                        <Input placeholder="اسم المقاول" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit">{editingContractorId ? 'حفظ التعديل' : 'إضافة'}</Button>
                  <DialogClose asChild>
                    <Button type="button" variant="outline" onClick={cancelEditingContractor}>
                      إلغاء
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        <div className="mt-6">
          {loading ? (
            <p className="text-sm text-muted-foreground">جاري التحميل...</p>
          ) : (
            <DataTable
              columns={columns}
              data={contractors}
              getRowId={(contractor) => String(contractor.id)}
              enableRowSelection
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}
