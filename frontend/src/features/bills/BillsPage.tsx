import { useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, ListChecks, LoaderCircle, Plus, ReceiptText, RefreshCw, Search, WalletCards, X } from 'lucide-react'
import { billsApi, isDemo } from './data'
import { errorMessage, filterBills, formatMoney, formatMonth, today, type BillFilter } from './rules'
import type { Bill, BillInput } from './types'
import { useBills } from './useBills'
import { BillForm } from './components/BillForm'
import { BillsList } from './components/BillsList'
import { DeleteBillDialog } from './components/DeleteBillDialog'
import { MonthPicker } from './components/MonthPicker'
import { Dialog } from './components/Dialog'

const filters: [BillFilter, string][] = [['ALL', 'Todos'], ['PENDING', 'Pendentes'], ['PAID', 'Pagos'], ['OVERDUE', 'Atrasados']]

export function BillsPage() {
  const [month, setMonth] = useState(() => today().slice(0, 7))
  const { bills, summary, loading, error, reload } = useBills(month)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<BillFilter>('ALL')
  const [form, setForm] = useState<{ bill: Bill | null } | null>(null)
  const [deleting, setDeleting] = useState<Bill | null>(null)
  const [resetting, setResetting] = useState(false)
  const [resetBusy, setResetBusy] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const mutationLock = useRef(false)
  const visibleBills = filterBills(bills, query, filter)
  const totalCents = bills.reduce((total, bill) => total + BigInt(bill.amount_cents), 0n)

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(null), 6000)
    return () => window.clearTimeout(timeout)
  }, [notice])

  function changeMonth(nextMonth: string) {
    setMonth(nextMonth)
    setActionError(null)
  }

  async function saveBill(input: BillInput, id?: number) {
    if (id !== undefined) await billsApi.update(id, input)
    else await billsApi.create(input)
    setNotice(id !== undefined ? 'Conta atualizada com sucesso.' : 'Conta adicionada com sucesso.')
    setActionError(null)
    if (input.reference_month.slice(0, 7) !== month) setMonth(input.reference_month.slice(0, 7))
    reload()
  }

  async function deleteBill(id: number) {
    await billsApi.remove(id)
    setNotice('Conta excluída com sucesso.')
    setActionError(null)
    reload()
  }

  async function toggleBill(bill: Bill) {
    if (mutationLock.current) return
    mutationLock.current = true
    setBusyId(bill.id)
    setActionError(null)
    try {
      const nextStatus = bill.status === 'PAID' ? 'PENDING' : 'PAID'
      await billsApi.update(bill.id, { status: nextStatus })
      setNotice(`${bill.name}: ${nextStatus === 'PAID' ? 'pagamento registrado' : 'marcada como pendente'}.`)
      reload()
    } catch (cause) { setActionError(errorMessage(cause)) }
    finally { setBusyId(null); mutationLock.current = false }
  }

  async function resetDemo() {
    if (mutationLock.current || !billsApi.reset) return
    mutationLock.current = true
    setResetBusy(true)
    setResetError(null)
    try {
      await billsApi.reset()
      setMonth(today().slice(0, 7))
      setQuery('')
      setFilter('ALL')
      reload()
      setResetting(false)
      setNotice('Demonstração restaurada com dados fictícios do mês atual.')
    } catch (cause) { setResetError(errorMessage(cause)) }
    finally { setResetBusy(false); mutationLock.current = false }
  }

  return (
    <>
      <a href="#main-content" className="skip-link">Ir para o conteúdo</a>
      <header className="app-header">
        <div className="page-container flex min-h-20 flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-3"><div className="brand-symbol"><WalletCards size={22} aria-hidden="true" /></div><span className="text-lg font-semibold tracking-tight">Minhas Contas<span className="text-accent">.</span></span></div>
          {isDemo ? <div className="flex flex-wrap items-center gap-3"><span className="demo-badge">Demonstração</span><button className="quiet-button text-xs" onClick={() => { setResetting(true); setResetError(null) }} disabled={busyId !== null}><RefreshCw size={14} aria-hidden="true" />Restaurar demonstração</button></div> : <span className="hidden text-xs text-muted sm:block">Seu mês. Sob controle.</span>}
        </div>
      </header>
      <main id="main-content" className="page-container py-8 sm:py-10">
        <div className="mb-7 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div><p className="eyebrow">Clareza para seguir em frente</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Contas do mês</h1><p className="mt-3 text-sm leading-6 text-muted">Seus compromissos em um só lugar, um mês de cada vez.</p></div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center"><MonthPicker month={month} onChange={changeMonth} disabled={busyId !== null} /><button id="new-bill-button" type="button" className="primary-button" onClick={() => setForm({ bill: null })} disabled={busyId !== null}><Plus size={18} aria-hidden="true" />Nova conta</button></div>
        </div>
        <div className="mb-7 grid gap-4 sm:grid-cols-2" aria-label="Resumo mensal" aria-busy={loading}>
          <section className="summary-card"><div className="flex items-center justify-between"><h2 className="text-sm text-muted">Total previsto</h2><WalletCards className="text-accent" size={21} aria-hidden="true" /></div><p className="summary-value">{loading ? <span className="skeleton block h-10 w-48" /> : summary ? formatMoney(totalCents) : '—'}</p><p className="mt-2 text-xs text-muted">Competência inteira · {formatMonth(month)}</p></section>
          <section className="summary-card"><div className="flex items-center justify-between"><h2 className="text-sm text-muted">Contas cadastradas</h2><ListChecks className="text-violet" size={21} aria-hidden="true" /></div><p className="summary-value">{loading ? <span className="skeleton block h-10 w-20" /> : summary?.bill_count ?? '—'}</p><p className="mt-2 text-xs text-muted">Todos os compromissos da competência</p></section>
        </div>
        {actionError && <div role="alert" className="error-message mb-4"><AlertCircle size={18} aria-hidden="true" /><p className="flex-1">{actionError}</p><button className="icon-button" aria-label="Fechar mensagem de erro" onClick={() => setActionError(null)}><X size={16} aria-hidden="true" /></button></div>}
        <section className="panel" aria-labelledby="bills-heading" aria-busy={loading}>
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-6 sm:px-6"><h2 id="bills-heading" className="font-semibold">Suas contas</h2><span className="text-xs text-muted first-letter:uppercase">{formatMonth(month)}</span></div>
          <div className="list-toolbar">
            <div className="relative min-w-0 flex-1"><label className="sr-only" htmlFor="bill-search">Buscar conta pelo nome</label><Search size={17} className="pointer-events-none absolute top-3.5 left-3.5 text-muted" aria-hidden="true" /><input id="bill-search" type="search" className="field-input pl-11" placeholder="Buscar conta pelo nome…" value={query} onChange={event => setQuery(event.target.value)} /></div>
            <div className="filter-group" role="group" aria-label="Filtrar por status">{filters.map(([value, label]) => <button key={value} className="filter-button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
          </div>
          {!loading && !error && <p className="px-5 pb-4 text-xs text-muted sm:px-6" role="status">{visibleBills.length} de {bills.length} contas · ordenadas por vencimento</p>}
          {loading ? <div role="status" className="empty-state"><LoaderCircle className="animate-spin text-accent" size={26} aria-hidden="true" /><p>Carregando suas contas…</p></div>
            : error ? <div className="empty-state"><AlertCircle className="text-danger" size={28} aria-hidden="true" /><h3>Não foi possível carregar suas contas</h3><p role="alert">{error}</p><button className="secondary-button" onClick={reload}><RefreshCw size={16} aria-hidden="true" />Tentar novamente</button></div>
            : bills.length === 0 ? <div className="empty-state"><ReceiptText size={32} className="text-accent" aria-hidden="true" /><h3>Um novo mês para organizar</h3><p>Você ainda não tem contas em {formatMonth(month)}.</p><button className="primary-button" onClick={() => setForm({ bill: null })}><Plus size={17} aria-hidden="true" />Adicionar primeira conta</button></div>
            : visibleBills.length === 0 ? <div className="empty-state"><Search size={28} className="text-accent" aria-hidden="true" /><h3>Nenhuma conta encontrada</h3><p>Tente outro nome ou remova os filtros. Os indicadores continuam mostrando o mês inteiro.</p><button className="secondary-button" onClick={() => { setQuery(''); setFilter('ALL') }}>Limpar busca e filtros</button></div>
            : <BillsList bills={visibleBills} busyId={busyId} onToggle={bill => void toggleBill(bill)} onEdit={bill => setForm({ bill })} onDelete={setDeleting} />}
        </section>
        <footer className="mt-6 text-center text-xs leading-6 text-muted">{isDemo ? 'Dados fictícios · salvos apenas neste navegador' : 'Mais clareza para cuidar do seu dinheiro.'}</footer>
      </main>
      {form && <BillForm bill={form.bill} month={month} onSave={saveBill} onClose={() => setForm(null)} />}
      {deleting && <DeleteBillDialog bill={deleting} onDelete={deleteBill} onClose={() => setDeleting(null)} />}
      {resetting && <Dialog title="Restaurar demonstração?" description="As alterações desta demonstração serão substituídas por exemplos fictícios do mês atual. Suas contas pessoais não serão alteradas." busy={resetBusy} onClose={() => setResetting(false)}>
        {resetError && <p role="alert" className="error-message">{resetError}</p>}<div className="dialog-actions"><button data-initial-focus className="secondary-button" disabled={resetBusy} onClick={() => setResetting(false)}>Cancelar</button><button className="primary-button" disabled={resetBusy} onClick={() => void resetDemo()}>{resetBusy ? 'Restaurando…' : 'Restaurar exemplos'}</button></div>
      </Dialog>}
      {notice && <div role="status" className="toast"><CheckCircle2 className="shrink-0 text-success" size={19} aria-hidden="true" /><span>{notice}</span><button className="icon-button shrink-0" aria-label="Fechar notificação" onClick={() => setNotice(null)}><X size={16} aria-hidden="true" /></button></div>}
    </>
  )
}
