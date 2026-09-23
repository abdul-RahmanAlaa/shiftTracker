import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import type { AddLog } from '@/App'

const vehicleSchema = z.object({
  vehicleNo: z.number().int().positive('رقم السيارة مطلوب'),
  trailerNo: z.number().int().positive('رقم المقطورة يجب أن يكون رقمًا موجبًا'),
  contractorId: z.number().int().positive('المقاول مطلوب')
})

type VehicleFormValues = z.infer<typeof vehicleSchema>

export function VehiclesSettings({ addLog }: { addLog: AddLog }): React.JSX.Element {
  const [contractors, setContractors] = useState<{ id: number; name: string }[]>([])
  const [vehicles, setVehicles] = useState<
    { vehicleNo: number; trailerNo: number | null; contractorId: number }[]
  >([])
  const [loading, setLoading] = useState(true)
  const vehicleForm = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      vehicleNo: undefined,
      trailerNo: undefined,
      contractorId: undefined
    }
  })

  useEffect(() => {
    void Promise.all([window.api.listContractors(), window.api.listVehicles()]).then(
      ([contractorsResult, vehiclesResult]) => {
        if (contractorsResult.ok) setContractors(contractorsResult.data)
        if (vehiclesResult.ok) setVehicles(vehiclesResult.data)
        setLoading(false)
      }
    )
  }, [])

  async function handleCreateVehicle(values: VehicleFormValues): Promise<void> {
    const result = await window.api.createVehicle(values)
    addLog(
      result.ok
        ? `✅ عربية: ${result.data?.vehicleNo}`
        : `❌ عربية: ${result.errors?.map((x) => x.message).join(', ')}`
    )
    if (result.ok) {
      vehicleForm.reset()
      setLoading(true)
      const [contractorsResult, vehiclesResult] = await Promise.all([
        window.api.listContractors(),
        window.api.listVehicles()
      ])
      if (contractorsResult.ok) setContractors(contractorsResult.data)
      if (vehiclesResult.ok) setVehicles(vehiclesResult.data)
      setLoading(false)
    } else {
      result.errors.forEach((error) => {
        if (
          error.field === 'vehicleNo' ||
          error.field === 'trailerNo' ||
          error.field === 'contractorId'
        ) {
          vehicleForm.setError(error.field, { message: error.message })
        }
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>العربيات</CardTitle>
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
                        field.onChange(
                          event.target.value === '' ? undefined : Number(event.target.value)
                        )
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
                  <FormLabel>رقم المقطورة</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="رقم المقطورة"
                      value={field.value ?? ''}
                      onChange={(event) =>
                        field.onChange(
                          event.target.value === '' ? undefined : Number(event.target.value)
                        )
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
        <div className="mt-6">
          {loading ? (
            <p className="text-sm text-muted-foreground">جاري التحميل...</p>
          ) : vehicles.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا يوجد بيانات بعد</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم السيارة</TableHead>
                  <TableHead>رقم المقطورة</TableHead>
                  <TableHead>المقاول</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicles.map((vehicle) => {
                  const contractor = contractors.find((item) => item.id === vehicle.contractorId)
                  return (
                    <TableRow key={vehicle.vehicleNo}>
                      <TableCell>{vehicle.vehicleNo}</TableCell>
                      <TableCell>{vehicle.trailerNo ?? '-'}</TableCell>
                      <TableCell>{contractor?.name ?? '-'}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
