import { today } from './rules.ts'
import type { Bill, BillInput, BillsDataSource } from './types.ts'

export const DEMO_STORAGE_KEY = 'minhas-contas:demo:v1'
type DemoStorage = Pick<Storage, 'getItem' | 'setItem'>

function validateDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]
}

function validateInput(input: BillInput): void {
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 120) throw new Error('Informe um nome com até 120 caracteres.')
  if (!Number.isSafeInteger(input.amount_cents) || input.amount_cents <= 0) throw new Error('Informe um valor positivo em centavos inteiros.')
  if (!validateDate(input.reference_month) || !validateDate(input.due_date)) throw new Error('Informe datas válidas, sem horário.')
  if (input.reference_month.slice(0, 7) !== input.due_date.slice(0, 7)) throw new Error('O vencimento deve pertencer ao mês da competência.')
  if (!['PENDING', 'PAID'].includes(input.status)) throw new Error('Status inválido.')
  if (input.paid_at !== null && !validateDate(input.paid_at)) throw new Error('Informe uma data de pagamento válida.')
}

function fixtures(currentDate: string): Bill[] {
  const month = currentDate.slice(0, 7)
  const examples: [string, number, string, boolean][] = [
    ['Moradia Aurora', 142000, '05', true],
    ['Conexão Nuvem', 9900, '08', true],
    ['Energia Horizonte', 18640, '12', false],
    ['Água Cristal', 7250, '15', false],
    ['Academia Órbita', 11900, '20', false],
    ['Clube de leitura', 3990, currentDate.slice(8), false],
  ]
  return examples.map(([name, amount_cents, day, paid], index) => ({
    id: index + 1, name, amount_cents, reference_month: `${month}-01`,
    due_date: `${month}-${day}`, status: paid ? 'PAID' : 'PENDING',
    paid_at: paid ? currentDate : null, is_overdue: !paid && `${month}-${day}` < currentDate,
    created_at: `${currentDate}T12:00:00Z`, updated_at: `${currentDate}T12:00:00Z`,
  }))
}

/** A demo acessa exclusivamente sua própria chave; dados inválidos exigem restauração explícita. */
export function createDemoApi(storage: DemoStorage, getToday = today): BillsDataSource {
  function save(bills: Bill[]) {
    try { storage.setItem(DEMO_STORAGE_KEY, JSON.stringify({ version: 1, bills })) }
    catch { throw new Error('Não foi possível salvar a demonstração. Libere o armazenamento deste navegador e tente novamente.') }
  }

  function read(): Bill[] {
    let raw: string | null
    try { raw = storage.getItem(DEMO_STORAGE_KEY) }
    catch { throw new Error('O armazenamento deste navegador está indisponível para a demonstração.') }
    if (raw === null) {
      const bills = fixtures(getToday())
      save(bills)
      return bills
    }
    try {
      const data = JSON.parse(raw) as { version: number; bills: Bill[] }
      if (data.version !== 1 || !Array.isArray(data.bills)) throw new Error()
      const ids = new Set<number>()
      for (const bill of data.bills) {
        validateInput(bill)
        if (!Number.isSafeInteger(bill.id) || bill.id <= 0 || ids.has(bill.id)) throw new Error()
        if (bill.reference_month.slice(8) !== '01' || (bill.status === 'PAID') !== (bill.paid_at !== null)) throw new Error()
        ids.add(bill.id)
      }
      return data.bills
    } catch { throw new Error('Os dados da demonstração estão inválidos. Use “Restaurar demonstração” para recomeçar.') }
  }

  function current(bill: Bill): Bill {
    return { ...bill, is_overdue: bill.status === 'PENDING' && bill.due_date < getToday() }
  }

  function list(month: string): Bill[] {
    if (!validateDate(`${month}-01`)) throw new Error('Informe uma competência válida.')
    return read().filter(bill => bill.reference_month === `${month}-01`)
      .map(current).sort((a, b) => a.due_date.localeCompare(b.due_date) || a.id - b.id)
  }

  function make(input: BillInput, id: number, created_at?: string): Bill {
    validateInput(input)
    const timestamp = new Date().toISOString()
    return current({ ...input, id, name: input.name.trim(), reference_month: `${input.reference_month.slice(0, 7)}-01`,
      paid_at: input.status === 'PENDING' ? null : input.paid_at || getToday(),
      created_at: created_at ?? timestamp, updated_at: timestamp, is_overdue: false })
  }

  return {
    async list(month) { return list(month) },
    async summary(month) {
      const bills = list(month)
      return { reference_month: `${month}-01`, bill_count: bills.length, total_amount_cents: bills.reduce((sum, bill) => sum + bill.amount_cents, 0) }
    },
    async create(input) {
      const bills = read()
      const bill = make(input, bills.reduce((max, item) => Math.max(max, item.id), 0) + 1)
      save([...bills, bill])
      return bill
    },
    async update(id, input) {
      const bills = read()
      const index = bills.findIndex(bill => bill.id === id)
      if (index < 0) throw new Error('Conta não encontrada.')
      const bill = make({ ...bills[index], ...input }, id, bills[index].created_at)
      bills[index] = bill
      save(bills)
      return bill
    },
    async remove(id) {
      const bills = read()
      if (!bills.some(bill => bill.id === id)) throw new Error('Conta não encontrada.')
      save(bills.filter(bill => bill.id !== id))
    },
    async reset() { save(fixtures(getToday())) },
  }
}
