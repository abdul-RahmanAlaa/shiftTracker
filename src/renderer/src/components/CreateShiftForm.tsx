/* eslint-disable react-refresh/only-export-components */
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { NumberField } from '@/pages/AddTripPage'
import type { ResourceState } from '@/pages/AddTripPage'

export const createShiftSchema = z.object({
  vehicleNo: z.number().int().positive('السيارة مطلوبة'),
  crusherCubicDefault: z.number().nonnegative('تكعيب الكسارة مطلوب'),
  clientCubicDefault: z.number().nonnegative('تكعيب العميل مطلوب'),
  startDate: z.string().min(1, 'تاريخ البداية مطلوب'),
  reportedDestination: z.string().optional(),
  reportedTripCount: z.number().nonnegative().optional(),
  notes: z.string().optional()
})

export type CreateShiftValues = z.infer<typeof createShiftSchema>

export function CreateShiftForm({
  form,
  vehicles,
  onSubmit
}: {
  form: ReturnType<typeof useForm<CreateShiftValues>>
  vehicles: ResourceState['vehicles']
  onSubmit: (values: CreateShiftValues) => void
}): React.JSX.Element {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2">
        <FormField
          control={form.control}
          name="vehicleNo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>السيارة</FormLabel>
              <Select
                value={field.value ? String(field.value) : ''}
                onValueChange={(value) => field.onChange(Number(value))}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="اختار السيارة" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {vehicles.map((vehicle) => (
                    <SelectItem key={vehicle.vehicleNo} value={String(vehicle.vehicleNo)}>
                      {vehicle.vehicleNo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <NumberField
          control={form.control}
          name="crusherCubicDefault"
          label="تكعيب الكسارة"
          required
        />
        <NumberField
          control={form.control}
          name="clientCubicDefault"
          label="تكعيب العميل"
          required
        />
        <FormField
          control={form.control}
          name="startDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>تاريخ البداية *</FormLabel>
              <FormControl>
                <DatePicker value={field.value} onChange={field.onChange} placeholder="اختر تاريخ البداية" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="reportedDestination"
          render={({ field }) => (
            <FormItem>
              <FormLabel>الوجهة</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <NumberField control={form.control} name="reportedTripCount" label="عدد النقلات" />
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem className="md:col-span-2">
              <FormLabel>ملاحظات</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">فتح الوردية</Button>
      </form>
    </Form>
  )
}
