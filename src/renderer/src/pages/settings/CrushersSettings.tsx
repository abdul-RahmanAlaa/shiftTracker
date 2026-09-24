import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, type Resolver } from 'react-hook-form'
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

const crusherSchema = z.object({
  name: z.string().min(1, 'اسم الكسارة مطلوب'),
  initialPrice: z
    .string()
    .optional()
    .transform((val) => (val && val.trim() !== '' ? Number(val) : undefined))
    .refine((val) => val === undefined || val >= 0, 'السعر لازم يكون رقم موجب')
})

type CrusherFormValues = z.infer<typeof crusherSchema>
type CrusherFormInput = z.input<typeof crusherSchema>
type Crusher = { id: number; name: string; initialPrice: number | null }

export function CrushersSettings(): React.JSX.Element {
  const [crushers, setCrushers] = useState<Crusher[]>([])
  const [loading, setLoading] = useState(true)
  const [editingCrusherId, setEditingCrusherId] = useState<number | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const crusherForm = useForm<CrusherFormInput>({
    resolver: zodResolver(crusherSchema) as Resolver<CrusherFormInput>,
    defaultValues: { name: '', initialPrice: '' }
  })

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

  async function handleSaveCrusher(values: CrusherFormInput): Promise<void> {
    const parsedValues: CrusherFormValues = crusherSchema.parse(values)
    const result = editingCrusherId
      ? await window.api.updateCrusher({ id: editingCrusherId, ...parsedValues })
      : await window.api.createCrusher(parsedValues)
    if (result.ok) {
      setIsDialogOpen(false)
      crusherForm.reset()
      setEditingCrusherId(null)
      await loadCrushers()
    } else {
      result.errors.forEach((error) => {
        if (error.field === 'name' || error.field === 'initialPrice') {
          crusherForm.setError(error.field, { message: error.message })
        }
      })
    }
  }

  function startEditingCrusher(crusher: Crusher): void {
    setEditingCrusherId(crusher.id)
    crusherForm.reset({
      name: crusher.name,
      initialPrice: crusher.initialPrice === null ? '' : String(crusher.initialPrice)
    })
    setIsDialogOpen(true)
  }

  function cancelEditingCrusher(): void {
    setEditingCrusherId(null)
    crusherForm.reset()
    setIsDialogOpen(false)
  }

  async function handleDeleteCrusher(crusher: Crusher): Promise<void> {
    if (!confirm(`متأكد إنك عايز تمسح الكسارة ${crusher.name}؟`)) return
    const result = await window.api.deleteCrusher({ id: crusher.id })
    if (result.ok) {
      if (editingCrusherId === crusher.id) cancelEditingCrusher()
      await loadCrushers()
    }
  }

  function handleDialogChange(open: boolean): void {
    setIsDialogOpen(open)
    if (!open) {
      setEditingCrusherId(null)
      crusherForm.reset()
    }
  }

  const columns: ColumnDef<Crusher, unknown>[] = [
    { accessorKey: 'name', header: 'الاسم' },
    {
      accessorKey: 'initialPrice',
      header: 'السعر الافتراضي',
      cell: ({ getValue }) => getValue() ?? '-'
    },
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
            onClick={() => startEditingCrusher(row.original)}
          >
            تعديل
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => void handleDeleteCrusher(row.original)}
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
        <CardTitle>الكسارات</CardTitle>
      </CardHeader>
      <CardContent>
        <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button
              type="button"
              onClick={() => {
                setEditingCrusherId(null)
                crusherForm.reset()
              }}
            >
              إضافة كسارة
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCrusherId ? 'تعديل كسارة' : 'إضافة كسارة جديدة'}</DialogTitle>
            </DialogHeader>
            <Form {...crusherForm}>
              <form onSubmit={crusherForm.handleSubmit(handleSaveCrusher)} className="grid gap-4">
                <FormField
                  control={crusherForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>اسم الكسارة</FormLabel>
                      <FormControl>
                        <Input placeholder="اسم الكسارة" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={crusherForm.control}
                  name="initialPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>السعر الافتراضي</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="السعر الافتراضي"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit">{editingCrusherId ? 'حفظ التعديل' : 'إضافة'}</Button>
                  <DialogClose asChild>
                    <Button type="button" variant="outline" onClick={cancelEditingCrusher}>
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
              data={crushers}
              getRowId={(crusher) => String(crusher.id)}
              enableRowSelection
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}
