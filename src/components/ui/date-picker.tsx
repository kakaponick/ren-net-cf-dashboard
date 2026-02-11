"use client"

import * as React from "react"
import { format, addMonths, addYears } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

const DATE_FORMAT = "dd-MM-yyyy"

const PRESETS = [
  { label: "+1 mo", getDate: () => addMonths(new Date(), 1) },
  { label: "+3 mo", getDate: () => addMonths(new Date(), 3) },
  { label: "+1 yr", getDate: () => addYears(new Date(), 1) },
  { label: "+2 yr", getDate: () => addYears(new Date(), 2) },
] as const

interface DatePickerProps {
  date?: Date
  onDateChange: (date: Date | undefined) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function DatePicker({
  date,
  onDateChange,
  placeholder = "Pick a date",
  className,
  disabled = false,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [currentMonth, setCurrentMonth] = React.useState<Date>(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  )

  const handlePreset = (newDate: Date) => {
    onDateChange(newDate)
    setCurrentMonth(new Date(newDate.getFullYear(), newDate.getMonth(), 1))
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          data-empty={!date}
          className={cn(
            "w-full justify-start text-left font-normal transition-colors focus:ring-2",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          {date ? format(date, DATE_FORMAT) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" sideOffset={4}>
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => {
            onDateChange(d)
            setOpen(false)
          }}
          month={currentMonth}
          onMonthChange={setCurrentMonth}
          captionLayout="dropdown"
          initialFocus
        />
        <div className="flex flex-wrap gap-1.5 border-t p-2">
          {PRESETS.map((preset) => (
            <Button
              key={preset.label}
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => handlePreset(preset.getDate())}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
