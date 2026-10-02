export type BillStatus = 'PENDING' | 'PAID'

export interface Bill {
  id: number
  name: string
  reference_month: string
  due_date: string
  amount_cents: number
  status: BillStatus
  paid_at: string | null
  created_at: string
  updated_at: string
  is_overdue: boolean
}

export interface BillInput {
  name: string
  reference_month: string
  due_date: string
  amount_cents: number
  status: BillStatus
  paid_at: string | null
}

export interface BillSummary {
  reference_month: string
  total_amount_cents: number
  bill_count: number
}

export interface BillsDataSource {
  list: (month: string, signal?: AbortSignal) => Promise<Bill[]>
  summary: (month: string, signal?: AbortSignal) => Promise<BillSummary>
  create: (input: BillInput) => Promise<Bill>
  update: (id: number, input: Partial<BillInput>) => Promise<Bill>
  remove: (id: number) => Promise<void>
  reset?: () => Promise<void>
}
