import * as React from 'react'
import { DayPicker } from 'react-day-picker'
import { cn } from '@/lib/utils'

export function Calendar({
  className,
  ...props
}: React.ComponentProps<typeof DayPicker>): React.JSX.Element {
  return (
    <DayPicker
      showOutsideDays
      className={cn('w-full p-3', className)}
      classNames={{
        months: 'flex w-full flex-col gap-2 sm:flex-row',
        month: 'w-full space-y-6',
        month_caption: 'flex justify-center pb-2 relative items-center',
        caption_label: 'hidden',
        nav: 'flex items-center gap-1',
        button_previous: 'absolute left-1 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100',
        button_next: 'absolute right-1 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100',
        month_grid: 'w-full border-collapse space-y-1',
        weekdays: 'flex w-full',
        weekday: 'flex-1 rounded-md text-muted-foreground font-normal text-[0.8rem]',
        week: 'flex w-full mt-2',
        day: 'relative flex-1 p-0 text-center text-sm focus-within:relative focus-within:z-20',
        day_button: 'h-8 w-full p-0 font-normal aria-selected:opacity-100',
        selected:
          'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
        today: 'bg-accent text-accent-foreground',
        outside: 'text-muted-foreground opacity-50',
        disabled: 'text-muted-foreground opacity-50',
        hidden: 'invisible'
      }}
      {...props}
    />
  )
}
