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

const driverSchema = z.object({
  name: z.string().min(1, 'اسم السائق مطلوب'),
  phone1: z.string().optional(),
  phone2: z.string().optional()
})

type DriverFormValues = z.infer<typeof driverSchema>
type Driver = { id: number; name: string; phone1: string | null; phone2: string | null }

export function DriversSettings(): React.JSX.Element {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [editingDriverId, setEditingDriverId] = useState<number | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const driverForm = useForm<DriverFormValues>({
    resolver: zodResolver(driverSchema),
    defaultValues: { name: '', phone1: '', phone2: '' }
  })

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

  async function handleSaveDriver(values: DriverFormValues): Promise<void> {
    const result = editingDriverId
      ? await window.api.updateDriver({ id: editingDriverId, ...values })
      : await window.api.createDriver(values)
    if (result.ok) {
      setIsDialogOpen(false)
      driverForm.reset()
      setEditingDriverId(null)
      await loadDrivers()
    } else {
      result.errors.forEach((error) => {
        if (error.field === 'name' || error.field === 'phone1' || error.field === 'phone2') {
          driverForm.setError(error.field, { message: error.message })
        }
      })
    }
  }

  function startEditingDriver(driver: Driver): void {
    setEditingDriverId(driver.id)
    driverForm.reset({
      name: driver.name,
      phone1: driver.phone1 ?? '',
      phone2: driver.phone2 ?? ''
    })
    setIsDialogOpen(true)
  }

  function cancelEditingDriver(): void {
    setEditingDriverId(null)
    driverForm.reset()
    setIsDialogOpen(false)
  }

  async function handleDeleteDriver(driver: Driver): Promise<void> {
    if (!confirm(`متأكد إنك عايز تمسح السائق ${driver.name}؟`)) return
    const result = await window.api.deleteDriver({ id: driver.id })
    if (result.ok) {
      if (editingDriverId === driver.id) cancelEditingDriver()
      await loadDrivers()
    }
  }

  function handleDialogChange(open: boolean): void {
    setIsDialogOpen(open)
    if (!open) {
      setEditingDriverId(null)
      driverForm.reset()
    }
  }

  const columns: ColumnDef<Driver, unknown>[] = [
    { accessorKey: 'name', header: 'الاسم' },
    { accessorKey: 'phone1', header: 'تليفون 1', cell: ({ getValue }) => getValue() ?? '-' },
    { accessorKey: 'phone2', header: 'تليفون 2', cell: ({ getValue }) => getValue() ?? '-' },
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
            onClick={() => startEditingDriver(row.original)}
          >
            تعديل
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => void handleDeleteDriver(row.original)}
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
        <CardTitle>السائقون</CardTitle>
      </CardHeader>
      <CardContent>
        <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button
              type="button"
              onClick={() => {
                setEditingDriverId(null)
                driverForm.reset()
              }}
            >
              إضافة سائق
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingDriverId ? 'تعديل سائق' : 'إضافة سائق جديد'}</DialogTitle>
            </DialogHeader>
            <Form {...driverForm}>
              <form onSubmit={driverForm.handleSubmit(handleSaveDriver)} className="grid gap-4">
                <FormField
                  control={driverForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>اسم السائق</FormLabel>
                      <FormControl>
                        <Input placeholder="اسم السائق" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={driverForm.control}
                  name="phone1"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>تليفون 1</FormLabel>
                      <FormControl>
                        <Input type="text" placeholder="تليفون 1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={driverForm.control}
                  name="phone2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>تليفون 2</FormLabel>
                      <FormControl>
                        <Input type="text" placeholder="تليفون 2" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit">{editingDriverId ? 'حفظ التعديل' : 'إضافة'}</Button>
                  <DialogClose asChild>
                    <Button type="button" variant="outline" onClick={cancelEditingDriver}>
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
              data={drivers}
              getRowId={(driver) => String(driver.id)}
              enableRowSelection
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}
