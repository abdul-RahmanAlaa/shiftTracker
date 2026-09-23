import { format, parse } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export function DatePicker({
  value,
  onChange,
  placeholder = 'اختر تاريخًا',
  disabled = false
}: {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}): React.JSX.Element {
  const selectedDate = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          data-empty={!selectedDate}
          className={cn(
            'w-full justify-start text-right font-normal',
            !selectedDate && 'text-muted-foreground'
          )}
        >
          <CalendarIcon className="ml-2 h-4 w-4" />
          {selectedDate ? format(selectedDate, 'dd/MM/yyyy') : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => onChange(date ? format(date, 'yyyy-MM-dd') : '')}
        />
      </PopoverContent>
    </Popover>
  )
}
