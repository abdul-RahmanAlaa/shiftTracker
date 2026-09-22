import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useOutletContext } from 'react-router-dom'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { AddLog } from '@/App'

const vehicleSchema = z.object({
  vehicleNo: z.number().int().positive('رقم السيارة مطلوب'),
  trailerNo: z.number().int().positive('رقم المقطورة يجب أن يكون رقمًا موجبًا').optional(),
  contractorId: z.number().int().positive('المقاول مطلوب')
})

type VehicleFormValues = z.infer<typeof vehicleSchema>

export function SettingsPage(): React.JSX.Element {
  const { addLog } = useOutletContext<{ addLog: AddLog }>()
  const [contractorName, setContractorName] = useState('')
  const [contractors, setContractors] = useState<{ id: number; name: string }[]>([])
  const [driverName, setDriverName] = useState('')

  const vehicleForm = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      vehicleNo: undefined,
      trailerNo: undefined,
      contractorId: undefined
    }
  })

  useEffect(() => {
    void window.api.listContractors().then((result) => {
      if (result.ok) setContractors(result.data)
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
    if (result.ok) setContractorName('')
  }

  async function handleCreateVehicle(values: VehicleFormValues): Promise<void> {
    const result = await window.api.createVehicle(values)
    addLog(
      result.ok
        ? `✅ عربية: ${result.data?.vehicleNo}`
        : `❌ عربية: ${result.errors?.map((x) => x.message).join(', ')}`
    )
    if (result.ok) {
      vehicleForm.reset()
    } else {
      result.errors.forEach((error) => {
        if (error.field === 'vehicleNo' || error.field === 'trailerNo' || error.field === 'contractorId') {
          vehicleForm.setError(error.field, { message: error.message })
        }
      })
    }
  }

  async function handleCreateDriver(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const result = await window.api.createDriver({ name: driverName })
    addLog(
      result.ok
        ? `✅ سائق: ${result.data?.name} (id: ${result.data?.id})`
        : `❌ سائق: ${result.errors?.map((x) => x.message).join(', ')}`
    )
    if (result.ok) setDriverName('')
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">بيانات أساسية</h1>

      <div className="space-y-6">
        <h3>1) مقاول نقل</h3>
        <form onSubmit={handleCreateContractor}>
          <input
            value={contractorName}
            onChange={(e) => setContractorName(e.target.value)}
            placeholder="اسم المقاول"
          />
          <button type="submit">إضافة</button>
        </form>

        <h3>3) سائق</h3>
        <form onSubmit={handleCreateDriver}>
          <input
            value={driverName}
            onChange={(e) => setDriverName(e.target.value)}
            placeholder="اسم السائق"
          />
          <button type="submit">إضافة</button>
        </form>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>عربية</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...vehicleForm}>
              <form
                onSubmit={vehicleForm.handleSubmit(handleCreateVehicle)}
                className="grid gap-4 md:grid-cols-2"
              >
                <FormField
                  control={vehicleForm.control}
                  name="vehicleNo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>رقم السيارة</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="رقم السيارة"
                          value={field.value ?? ''}
                          onChange={(event) =>
                            field.onChange(event.target.value === '' ? undefined : Number(event.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={vehicleForm.control}
                  name="trailerNo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>رقم المقطورة (اختياري)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="رقم المقطورة (اختياري)"
                          value={field.value ?? ''}
                          onChange={(event) =>
                            field.onChange(event.target.value === '' ? undefined : Number(event.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={vehicleForm.control}
                  name="contractorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>المقاول</FormLabel>
                      <Select
                        value={field.value ? String(field.value) : ''}
                        onValueChange={(value) => field.onChange(Number(value))}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="اختر المقاول" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {contractors.map((contractor) => (
                            <SelectItem key={contractor.id} value={String(contractor.id)}>
                              {contractor.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex items-end">
                  <Button type="submit">إضافة</Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
