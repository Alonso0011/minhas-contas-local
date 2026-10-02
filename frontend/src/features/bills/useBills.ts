import { useEffect, useState } from 'react'
import { billsApi } from './data'
import { errorMessage } from './rules'
import type { Bill, BillSummary } from './types'

interface Result {
  key: string
  bills: Bill[]
  summary: BillSummary | null
  error: string | null
}

export function useBills(month: string) {
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const key = `${month}:${revision}`

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([billsApi.list(month, controller.signal), billsApi.summary(month, controller.signal)])
      .then(([bills, summary]) => {
        if (!controller.signal.aborted) setResult({ key, bills, summary, error: null })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setResult({ key, bills: [], summary: null, error: errorMessage(error) })
      })
    return () => controller.abort()
  }, [key, month])

  const current = result?.key === key ? result : null
  return {
    bills: current?.bills ?? [],
    summary: current?.summary ?? null,
    error: current?.error ?? null,
    loading: !current,
    reload: () => setRevision((value) => value + 1),
  }
}
