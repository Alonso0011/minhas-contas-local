import { Check, Clock3, Info, LoaderCircle, Pencil, Trash2, TriangleAlert, Undo2 } from 'lucide-react'
import { formatDate, formatMoney, formatMonth } from '../rules'
import type { Bill } from '../types'

interface BillsListProps {
  bills: Bill[]
  busyId: number | null
  onToggle: (bill: Bill) => void
  onEdit: (bill: Bill) => void
  onDelete: (bill: Bill) => void
}

function StatusButton({ bill, busyId, onToggle }: Pick<BillsListProps, 'busyId' | 'onToggle'> & { bill: Bill }) {
  const paid = bill.status === 'PAID'
  const Icon = paid ? Check : bill.is_overdue ? TriangleAlert : Clock3
  const label = paid ? 'Pago' : bill.is_overdue ? 'Atrasada' : 'Pendente'
  const action = `Marcar ${bill.name} como ${paid ? 'pendente' : 'paga'}`
  return (
    <div className="flex items-center gap-2">
    <span className={`status-button ${paid ? 'status-paid' : bill.is_overdue ? 'status-overdue' : 'status-pending'}`}><Icon size={13} aria-hidden="true" />{label}</span>
    <button
      type="button"
      className={paid ? 'icon-button' : 'pay-button'}
      title={action}
      aria-label={`${label}. ${action}`}
      disabled={busyId !== null}
      onClick={() => onToggle(bill)}
    >
      {busyId === bill.id ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : paid ? <Undo2 size={15} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
    </button>
    </div>
  )
}

function Actions({ bill, busyId, onEdit, onDelete }: Omit<BillsListProps, 'bills' | 'onToggle'> & { bill: Bill }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <button type="button" className="icon-button" title={`Editar ${bill.name}`} aria-label={`Editar ${bill.name}`} onClick={() => onEdit(bill)} disabled={busyId !== null}><Pencil size={16} aria-hidden="true" /></button>
      <button type="button" className="icon-button delete-button" title={`Excluir ${bill.name}`} aria-label={`Excluir ${bill.name}`} onClick={() => onDelete(bill)} disabled={busyId !== null}><Trash2 size={16} aria-hidden="true" /></button>
    </div>
  )
}

export function BillsList({ bills, busyId, onToggle, onEdit, onDelete }: BillsListProps) {
  return (
    <>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">Contas da competência selecionada</caption>
          <thead>
            <tr className="border-y border-line bg-surface text-[11px] font-semibold tracking-[0.055em] text-muted uppercase">
              <th scope="col" className="py-3.5 pr-4 pl-6">Mês</th>
              <th scope="col" className="px-4 py-3.5">Conta</th>
              <th scope="col" className="px-4 py-3.5">Vencimento</th>
              <th scope="col" className="px-4 py-3.5 text-right">Valor previsto</th>
              <th scope="col" className="px-4 py-3.5">Status</th>
              <th scope="col" className="px-4 py-3.5">Data do pagamento</th>
              <th scope="col" className="py-3.5 pr-5 pl-2"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            {bills.map((bill) => (
              <tr key={bill.id} className={`bill-row ${bill.status === 'PAID' ? 'paid-row' : ''}`}>
                <td className="py-4 pr-4 pl-6 whitespace-nowrap text-muted">{formatMonth(bill.reference_month, true)}</td>
                <th scope="row" className="max-w-64 px-4 py-4 font-medium break-words text-ink">{bill.name}</th>
                <td className={`px-4 py-4 whitespace-nowrap tabular-nums ${bill.is_overdue ? 'text-danger' : 'text-muted'}`}>{formatDate(bill.due_date)}</td>
                <td className="px-4 py-4 text-right font-semibold whitespace-nowrap text-ink tabular-nums">{formatMoney(bill.amount_cents)}</td>
                <td className="px-4 py-4"><StatusButton bill={bill} busyId={busyId} onToggle={onToggle} /></td>
                <td className="px-4 py-4 whitespace-nowrap text-muted tabular-nums">{bill.paid_at ? formatDate(bill.paid_at) : <span className="text-muted" aria-label="Não pago">—</span>}</td>
                <td className="py-3 pr-4 pl-2"><Actions bill={bill} busyId={busyId} onEdit={onEdit} onDelete={onDelete} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 px-4 pb-4 lg:hidden">
        {bills.map((bill) => (
          <article key={bill.id} className={`rounded-xl border p-4 ${bill.status === 'PAID' ? 'border-success/25 bg-success/10' : 'border-line bg-panel'}`} aria-label={bill.name}>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="min-w-0"><h3 className="font-semibold break-words text-ink">{bill.name}</h3><p className="mt-1 text-xs text-muted">Mês: {formatMonth(bill.reference_month, true)}</p></div>
              <div className="shrink-0 text-right"><p className="text-[11px] text-muted">Valor previsto</p><p className="mt-1 font-semibold text-ink tabular-nums">{formatMoney(bill.amount_cents)}</p></div>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-muted">Vencimento</dt><dd className={`mt-1 tabular-nums ${bill.is_overdue ? 'text-danger' : 'text-muted'}`}>{formatDate(bill.due_date)}</dd></div>
              <div><dt className="text-xs text-muted">Data do pagamento</dt><dd className="mt-1 text-muted tabular-nums">{bill.paid_at ? formatDate(bill.paid_at) : 'Não pago'}</dd></div>
            </dl>
            <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
              <StatusButton bill={bill} busyId={busyId} onToggle={onToggle} />
              <Actions bill={bill} busyId={busyId} onEdit={onEdit} onDelete={onDelete} />
            </div>
          </article>
        ))}
      </div>
      <div className="flex items-start gap-2 border-t border-line px-6 py-4 text-xs leading-5 text-muted">
        <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        <p>Use o botão verde para registrar um pagamento. Nas contas pagas, a seta retorna o status para pendente.</p>
      </div>
    </>
  )
}
