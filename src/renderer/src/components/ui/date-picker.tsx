import { format, parse } from 'date-fns'
import { arEG } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'
import { arSA as arSADayPicker } from 'react-day-picker/locale'
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
          dir="rtl"
          className={cn(
            'w-full justify-between text-right font-normal',
            !selectedDate && 'text-muted-foreground'
          )}
        >
          {selectedDate ? format(selectedDate, 'PPP', { locale: arEG }) : placeholder}
          <CalendarIcon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-88 p-0" align="center" dir="rtl">
        <Calendar
          className="w-full"
          mode="single"
          selected={selectedDate}
          captionLayout="dropdown"
          onSelect={(date) => onChange(date ? format(date, 'yyyy-MM-dd') : '')}
          defaultMonth={selectedDate}
          dir="rtl"
          locale={arSADayPicker}
          weekStartsOn={6}
        />
      </PopoverContent>
    </Popover>
  )
}
