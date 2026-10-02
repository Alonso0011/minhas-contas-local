import { useRef, useState, type FormEvent } from 'react'
import { LoaderCircle } from 'lucide-react'
import { errorMessage, moneyInput, parseMoney, today } from '../rules'
import type { Bill, BillInput, BillStatus } from '../types'
import { Dialog } from './Dialog'

interface BillFormProps {
  bill: Bill | null
  month: string
  onClose: () => void
  onSave: (input: BillInput, id?: number) => Promise<void>
}

function lastDay(month: string): string {
  const [year, number] = month.split('-').map(Number)
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return `${month}-${days[number - 1]}`
}

export function BillForm({ bill, month, onClose, onSave }: BillFormProps) {
  const [name, setName] = useState(bill?.name ?? '')
  const [referenceMonth, setReferenceMonth] = useState(bill?.reference_month.slice(0, 7) ?? month)
  const [dueDate, setDueDate] = useState(bill?.due_date ?? '')
  const [amount, setAmount] = useState(bill ? moneyInput(bill.amount_cents) : '')
  const [status, setStatus] = useState<BillStatus>(bill?.status ?? 'PENDING')
  const [paidAt, setPaidAt] = useState(bill?.paid_at ?? '')
  const [saving, setSaving] = useState(false)
  const savingLock = useRef(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (savingLock.current) return
    const cents = parseMoney(amount)
    if (!name.trim()) { setError('Informe o nome da conta.'); return }
    if (cents === null) { setError('Informe um valor positivo em reais, como 150,00 ou 1.200,00.'); return }
    if (dueDate.slice(0, 7) !== referenceMonth) { setError('O vencimento deve estar no mês de competência.'); return }
    savingLock.current = true
    setSaving(true)
    setError(null)
    try {
      await onSave({
        name: name.trim(),
        reference_month: `${referenceMonth}-01`,
        due_date: dueDate,
        amount_cents: cents,
        status,
        paid_at: status === 'PAID' ? paidAt || today() : null,
      }, bill?.id)
      onClose()
    } catch (cause) {
      setError(errorMessage(cause))
      setSaving(false)
      savingLock.current = false
    }
  }

  return (
    <Dialog title={bill ? 'Editar conta' : 'Nova conta'} description="Preencha os dados para organizar seu mês." busy={saving} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <fieldset disabled={saving} className="grid min-w-0 grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="bill-name">Nome da conta</label>
            <input className="field-input" id="bill-name" data-initial-focus required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Internet" autoComplete="off" />
          </div>
          <div>
            <label className="field-label" htmlFor="bill-month">Mês de competência</label>
            <input className="field-input" type="month" id="bill-month" min="0001-01" max="9999-12" required value={referenceMonth} onChange={(event) => {
              setReferenceMonth(event.target.value)
              if (dueDate.slice(0, 7) !== event.target.value) setDueDate('')
            }} />
          </div>
          <div>
            <label className="field-label" htmlFor="bill-due-date">Vencimento</label>
            <input className="field-input" type="date" id="bill-due-date" required min={`${referenceMonth}-01`} max={lastDay(referenceMonth)} value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="bill-amount">Valor previsto</label>
            <div className="relative">
              <span className="pointer-events-none absolute top-3 left-3.5 text-sm text-muted">R$</span>
              <input className="field-input pl-11 tabular-nums" id="bill-amount" inputMode="decimal" required value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" aria-describedby="amount-help" />
            </div>
            <p id="amount-help" className="mt-1.5 text-xs text-muted">Use vírgula para os centavos.</p>
          </div>
          <div>
            <label className="field-label" htmlFor="bill-status">Status</label>
            <select className="field-input" id="bill-status" value={status} onChange={(event) => {
              const nextStatus = event.target.value as BillStatus
              setStatus(nextStatus)
              setPaidAt(nextStatus === 'PAID' ? today() : '')
            }}>
              <option value="PENDING">Pendente</option>
              <option value="PAID">Pago</option>
            </select>
          </div>
          {status === 'PAID' && (
            <div className="rounded-xl border border-success/25 bg-success/10 p-4 sm:col-span-2">
              <label className="field-label" htmlFor="bill-paid-at">Data do pagamento</label>
              <input className="field-input bg-panel" type="date" id="bill-paid-at" min="0001-01-01" max="9999-12-31" required value={paidAt} onChange={(event) => setPaidAt(event.target.value)} />
              <p className="mt-2 text-xs leading-5 text-success">A data é preenchida automaticamente. Ajuste se você pagou em outro dia.</p>
            </div>
          )}
        </fieldset>
        {error && <p role="alert" className="mt-5 rounded-lg bg-danger/10 p-3 text-sm leading-6 text-danger">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="secondary-button" disabled={saving} onClick={onClose}>Cancelar</button>
          <button type="submit" className="primary-button" disabled={saving}>
            {saving && <LoaderCircle size={17} className="animate-spin" aria-hidden="true" />}
            {saving ? 'Salvando…' : bill ? 'Salvar alterações' : 'Adicionar conta'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
