import { Input } from '@/components/ui/input'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import type { Control, FieldPath, FieldValues } from 'react-hook-form'

export function NumberField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
>({
  control,
  name,
  label,
  required = false,
  money = false
}: {
  control: Control<TFieldValues>
  name: TName
  label: string
  required?: boolean
  money?: boolean
}): React.JSX.Element {
  return (
    <FormField<TFieldValues, TName>
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label}
            {required ? ' *' : ''}
          </FormLabel>
          <FormControl>
            <Input
              type="number"
              step={money ? '0.01' : 'any'}
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
  )
}
