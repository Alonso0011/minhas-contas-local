import assert from 'node:assert/strict'
import test from 'node:test'
import { createDemoApi, DEMO_STORAGE_KEY } from '../src/features/bills/demo.ts'
import { filterBills, formatMoney } from '../src/features/bills/rules.ts'
import type { BillInput } from '../src/features/bills/types.ts'

function setup() {
  const values = new Map<string, string>([['personal-key', 'preservar']])
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
  }
  return { values, storage, api: createDemoApi(storage, () => '2026-09-18') }
}

const input: BillInput = { name: 'Conta fictícia', reference_month: '2026-09-18', due_date: '2026-09-10', amount_cents: 12501, status: 'PENDING', paid_at: null }

test('primeira abertura usa o mês atual e a mesma chave persiste entre instâncias', async () => {
  const { api, storage, values } = setup()
  assert.equal((await api.list('2026-09')).length, 6)
  assert.deepEqual(await api.list('2026-10'), [])
  const created = await api.create(input)
  const reloaded = createDemoApi(storage, () => '2026-09-18')
  assert.ok((await reloaded.list('2026-09')).some(bill => bill.id === created.id))
  assert.equal(values.get('personal-key'), 'preservar')
  assert.deepEqual([...values.keys()].sort(), [DEMO_STORAGE_KEY, 'personal-key'].sort())
})

test('operações da demo funcionam sem qualquer chamada de rede', async context => {
  const network = context.mock.method(globalThis, 'fetch', () => { throw new Error('A demo não deve acessar a rede.') })
  const { api } = setup()
  await api.list('2026-09')
  const created = await api.create(input)
  await api.update(created.id, { status: 'PAID' })
  await api.summary('2026-09')
  await api.remove(created.id)
  await api.reset!()
  assert.equal(network.mock.calls.length, 0)
})

test('CRUD mantém datas, pagamento, atraso e resumo coerentes', async () => {
  const { api } = setup()
  const baseline = await api.summary('2026-09')
  const created = await api.create(input)
  assert.equal(created.reference_month, '2026-09-01')
  assert.equal(created.is_overdue, true)
  const paid = await api.update(created.id, { status: 'PAID' })
  assert.equal(paid.paid_at, '2026-09-18')
  assert.equal(paid.is_overdue, false)
  assert.equal((await api.update(created.id, { paid_at: '2026-09-11' })).paid_at, '2026-09-11')
  assert.equal((await api.update(created.id, { name: 'Nome editado' })).paid_at, '2026-09-11')
  assert.equal((await api.update(created.id, { status: 'PENDING' })).paid_at, null)
  assert.equal((await api.summary('2026-09')).total_amount_cents, baseline.total_amount_cents + 12501)
  await api.remove(created.id)
  assert.deepEqual(await api.summary('2026-09'), baseline)
  await assert.rejects(api.update(created.id, {}), /não encontrada/)
})

test('valida edições mescladas e não grava alterações inválidas', async () => {
  const { api } = setup()
  const created = await api.create(input)
  for (const invalid of [{ amount_cents: 1.5 }, { amount_cents: 0 }, { due_date: '2026-10-01' }, { paid_at: '2026-02-30' }, { due_date: '2026-09-10T00:00:00Z' }]) {
    await assert.rejects(api.update(created.id, invalid))
  }
  assert.deepEqual((await api.list('2026-09')).find(bill => bill.id === created.id), created)
})

test('busca ignora acentos e combina com status sem modificar resumo nem ordenação', async () => {
  const { api } = setup()
  const bills = await api.list('2026-09')
  const summary = await api.summary('2026-09')
  assert.equal(filterBills(bills, 'AGUA', 'OVERDUE')[0].name, 'Água Cristal')
  assert.equal(filterBills(bills, 'agua', 'PAID').length, 0)
  assert.ok(filterBills(bills, '', 'PENDING').every(bill => bill.status === 'PENDING'))
  assert.deepEqual(bills.map(bill => bill.due_date), bills.map(bill => bill.due_date).sort())
  assert.deepEqual(await api.summary('2026-09'), summary)
})

test('restauração modifica apenas a chave da demo e usa o mês atual', async () => {
  const { api, storage, values } = setup()
  await api.create(input)
  const nextMonth = createDemoApi(storage, () => '2026-10-01')
  await nextMonth.reset!()
  assert.equal((await nextMonth.list('2026-10')).length, 6)
  assert.equal((await nextMonth.list('2026-09')).length, 0)
  assert.equal(values.get('personal-key'), 'preservar')
})

test('armazenamento inválido ou indisponível falha sem sobrescrever dados', async () => {
  const { api, values } = setup()
  values.set(DEMO_STORAGE_KEY, '{inválido')
  await assert.rejects(api.list('2026-09'), /Restaurar demonstração/)
  assert.equal(values.get(DEMO_STORAGE_KEY), '{inválido')
  const unavailable = createDemoApi({ getItem: () => { throw new Error() }, setItem: () => {} })
  await assert.rejects(unavailable.list('2026-09'), /indisponível/)
})

test('falha de gravação não confirma uma mudança e mantém o registro anterior', async () => {
  const { api, storage } = setup()
  const created = await api.create(input)
  const full = createDemoApi({ ...storage, setItem: () => { throw new Error() } }, () => '2026-09-18')
  await assert.rejects(full.update(created.id, { status: 'PAID' }), /Não foi possível salvar/)
  assert.equal((await api.list('2026-09')).find(bill => bill.id === created.id)?.status, 'PENDING')
})

test('atraso é recalculado em outro dia; dinheiro grande mantém precisão de exibição', async () => {
  const { api, storage } = setup()
  await api.list('2026-09')
  const nextDay = createDemoApi(storage, () => '2026-09-21')
  assert.equal((await nextDay.list('2026-09')).find(bill => bill.name === 'Academia Órbita')?.is_overdue, true)
  assert.equal(formatMoney(27021597764222973n), 'R$ 270.215.977.642.229,73')
})
