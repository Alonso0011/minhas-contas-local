import type { Bill } from './types.ts'

const monthNames = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

export function today(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function formatMonth(month: string, short = false): string {
  const [year, number] = month.split('-')
  const name = monthNames[Number(number) - 1]
  return short ? `${name.slice(0, 3)}. ${year}` : `${name} de ${year}`
}

export function shiftMonth(month: string, offset: number): string {
  const [year, number] = month.split('-').map(Number)
  const index = year * 12 + number - 1 + offset
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`
}

export function formatDate(date: string): string {
  return date.split('-').reverse().join('/')
}

export function formatMoney(cents: number | bigint): string {
  const integer = BigInt(cents)
  return `R$ ${new Intl.NumberFormat('pt-BR').format(integer / 100n)},${String(integer % 100n).padStart(2, '0')}`
}

export function moneyInput(cents: number): string {
  const integer = BigInt(cents)
  return `${integer / 100n},${String(integer % 100n).padStart(2, '0')}`
}

/** Converte reais escritos no padrão brasileiro diretamente para centavos inteiros. */
export function parseMoney(input: string): number | null {
  const normalized = input.trim().replace(/^R\$\s*/, '')
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(normalized)) return null
  const [whole, fraction = ''] = normalized.replaceAll('.', '').split(',')
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
  if (cents <= 0n || cents > BigInt(Number.MAX_SAFE_INTEGER)) return null
  return Number(cents)
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível concluir a operação. Tente novamente.'
}

export type BillFilter = 'ALL' | 'PENDING' | 'PAID' | 'OVERDUE'

export function filterBills(bills: Bill[], query: string, filter: BillFilter): Bill[] {
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
  const search = normalize(query.trim())
  return bills.filter(bill => normalize(bill.name).includes(search) && (
    filter === 'ALL' || (filter === 'OVERDUE' ? bill.is_overdue : bill.status === filter)
  ))
}
