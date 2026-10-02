import { billsApi as personalApi } from './api'
import { createDemoApi } from './demo'
import type { BillsDataSource } from './types'

export const isDemo = __APP_MODE__ === 'demo'
export const billsApi: BillsDataSource = isDemo ? createDemoApi({
  getItem: key => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
}) : personalApi
