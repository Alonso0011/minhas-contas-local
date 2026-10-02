import type { Bill, BillInput, BillSummary } from './types'

const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new Error('Não foi possível conectar ao servidor. Verifique se a API está em execução.')
  }
  if (!response.ok) {
    let message = 'Não foi possível concluir a operação. Tente novamente.'
    if (response.status >= 500) message = 'O servidor está indisponível no momento. Tente novamente.'
    try {
      const body = await response.json() as { detail?: string | { msg: string }[] }
      if (typeof body.detail === 'string') message = body.detail
      else if (Array.isArray(body.detail)) message = body.detail.map((item) => item.msg.replace(/^Value error, /, '')).join(' ')
    } catch { /* Respostas sem JSON preservam a mensagem de erro HTTP. */ }
    throw new Error(message)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const billsApi = {
  list: (month: string, signal?: AbortSignal) => request<Bill[]>(`/bills?month=${month}`, { signal }),
  summary: (month: string, signal?: AbortSignal) => request<BillSummary>(`/bills/summary?month=${month}`, { signal }),
  create: (input: BillInput) => request<Bill>('/bills', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: number, input: Partial<BillInput>) => request<Bill>(`/bills/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  remove: (id: number) => request<void>(`/bills/${id}`, { method: 'DELETE' }),
}
