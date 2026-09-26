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

const clientSchema = z.object({
  name: z.string().min(1, 'اسم العميل مطلوب'),
  initialPrice: z
    .string()
    .optional()
    .transform((val) => (val && val.trim() !== '' ? Number(val) : undefined))
    .refine((val) => val === undefined || val >= 0, 'السعر لازم يكون رقم موجب')
})

type ClientFormValues = z.infer<typeof clientSchema>
type ClientFormInput = z.input<typeof clientSchema>
type Client = { id: number; name: string; initialPrice: number | null }

export function ClientsSettings(): React.JSX.Element {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [editingClientId, setEditingClientId] = useState<number | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const clientForm = useForm<ClientFormInput>({
    resolver: zodResolver(clientSchema, undefined, { raw: true }) as Resolver<ClientFormInput>,
    defaultValues: { name: '', initialPrice: '' }
  })

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

  async function handleSaveClient(values: ClientFormInput): Promise<void> {
    let parsedValues: ClientFormValues
    try {
      parsedValues = clientSchema.parse(values)
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.issues.forEach((issue) => {
          const field = issue.path[0]
          if (typeof field === 'string') {
            clientForm.setError(field as keyof ClientFormInput, { message: issue.message })
          }
        })
        return
      }
      throw error
    }

    const result = editingClientId
      ? await window.api.updateClient({ id: editingClientId, ...parsedValues })
      : await window.api.createClient(parsedValues)
    if (result.ok) {
      setIsDialogOpen(false)
      clientForm.reset()
      setEditingClientId(null)
      await loadClients()
    } else {
      result.errors.forEach((error) => {
        if (error.field === 'name' || error.field === 'initialPrice') {
          clientForm.setError(error.field, { message: error.message })
        }
      })
    }
  }

  function startEditingClient(client: Client): void {
    setEditingClientId(client.id)
    clientForm.reset({
      name: client.name,
      initialPrice: client.initialPrice === null ? '' : String(client.initialPrice)
    })
    setIsDialogOpen(true)
  }

  function cancelEditingClient(): void {
    setEditingClientId(null)
    clientForm.reset()
    setIsDialogOpen(false)
  }

  async function handleDeleteClient(client: Client): Promise<void> {
    if (!confirm(`متأكد إنك عايز تمسح العميل ${client.name}؟`)) return
    const result = await window.api.deleteClient({ id: client.id })
    if (result.ok) {
      if (editingClientId === client.id) cancelEditingClient()
      await loadClients()
    }
  }

  function handleDialogChange(open: boolean): void {
    setIsDialogOpen(open)
    if (!open) {
      setEditingClientId(null)
      clientForm.reset()
    }
  }

  const columns: ColumnDef<Client, unknown>[] = [
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
            onClick={() => startEditingClient(row.original)}
          >
            تعديل
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => void handleDeleteClient(row.original)}
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
        <CardTitle>العملاء</CardTitle>
      </CardHeader>
      <CardContent>
        <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button
              type="button"
              onClick={() => {
                setEditingClientId(null)
                clientForm.reset()
              }}
            >
              إضافة عميل
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingClientId ? 'تعديل عميل' : 'إضافة عميل جديد'}</DialogTitle>
            </DialogHeader>
            <Form {...clientForm}>
              <form
                noValidate
                onSubmit={clientForm.handleSubmit(handleSaveClient)}
                className="grid gap-4"
              >
                <FormField
                  control={clientForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>اسم العميل</FormLabel>
                      <FormControl>
                        <Input placeholder="اسم العميل" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={clientForm.control}
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
                  <Button type="submit">{editingClientId ? 'حفظ التعديل' : 'إضافة'}</Button>
                  <DialogClose asChild>
                    <Button type="button" variant="outline" onClick={cancelEditingClient}>
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
              data={clients}
              getRowId={(client) => String(client.id)}
              enableRowSelection
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}
