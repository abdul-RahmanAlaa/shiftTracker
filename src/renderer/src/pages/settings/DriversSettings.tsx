import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import type { AddLog } from '@/App'

const driverSchema = z.object({
  name: z.string().min(1, 'اسم السائق مطلوب'),
  phone1: z.string().optional(),
  phone2: z.string().optional()
})

type DriverFormValues = z.infer<typeof driverSchema>
type Driver = { id: number; name: string; phone1: string | null; phone2: string | null }

export function DriversSettings({ addLog }: { addLog: AddLog }): React.JSX.Element {
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
    addLog(
      result.ok
        ? editingDriverId
          ? `✅ سائق اتعدل: ${result.data.name} (id: ${result.data.id})`
          : `✅ سائق: ${result.data.name} (id: ${result.data.id})`
        : `❌ سائق: ${result.errors.map((x) => x.message).join(', ')}`
    )
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

  function handleDialogChange(open: boolean): void {
    setIsDialogOpen(open)
    if (!open) {
      setEditingDriverId(null)
      driverForm.reset()
    }
  }

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
          ) : drivers.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا يوجد بيانات بعد</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>تليفون 1</TableHead>
                  <TableHead>تليفون 2</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drivers.map((driver) => (
                  <TableRow key={driver.id}>
                    <TableCell>{driver.name}</TableCell>
                    <TableCell>{driver.phone1 ?? '-'}</TableCell>
                    <TableCell>{driver.phone2 ?? '-'}</TableCell>
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
