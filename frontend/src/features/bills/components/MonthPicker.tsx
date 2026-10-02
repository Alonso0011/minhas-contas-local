import { ChevronLeft, ChevronRight } from 'lucide-react'
import { shiftMonth } from '../rules'

interface MonthPickerProps {
  month: string
  disabled: boolean
  onChange: (month: string) => void
}

export function MonthPicker({ month, disabled, onChange }: MonthPickerProps) {
  return (
    <div className="flex h-11 items-center rounded-lg border border-line bg-panel shadow-xs">
      <button type="button" className="month-arrow rounded-l-lg" title="Mês anterior" aria-label="Mês anterior" disabled={disabled || month === '0001-01'} onClick={() => onChange(shiftMonth(month, -1))}><ChevronLeft size={17} aria-hidden="true" /></button>
      <input
        type="month"
        className="month-input h-full min-w-0 flex-1 border-x border-line bg-transparent px-3 text-sm font-medium text-muted"
        aria-label="Mês de competência"
        min="0001-01"
        max="9999-12"
        value={month}
        disabled={disabled}
        onChange={(event) => { if (event.target.validity.valid && /^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value)) onChange(event.target.value) }}
      />
      <button type="button" className="month-arrow rounded-r-lg" title="Próximo mês" aria-label="Próximo mês" disabled={disabled || month === '9999-12'} onClick={() => onChange(shiftMonth(month, 1))}><ChevronRight size={17} aria-hidden="true" /></button>
    </div>
  )
}
