import { useRef, useState } from 'react'
import { LoaderCircle, Trash2 } from 'lucide-react'
import { errorMessage, formatMoney } from '../rules'
import type { Bill } from '../types'
import { Dialog } from './Dialog'

interface DeleteBillDialogProps {
  bill: Bill
  onClose: () => void
  onDelete: (id: number) => Promise<void>
}

export function DeleteBillDialog({ bill, onClose, onDelete }: DeleteBillDialogProps) {
  const [saving, setSaving] = useState(false)
  const savingLock = useRef(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    if (savingLock.current) return
    savingLock.current = true
    setSaving(true)
    setError(null)
    try {
      await onDelete(bill.id)
      onClose()
    } catch (cause) {
      setError(errorMessage(cause))
      setSaving(false)
      savingLock.current = false
    }
  }

  return (
    <Dialog title="Excluir conta?" description="A conta será removida do seu mês. Esta ação não pode ser desfeita." onClose={onClose} busy={saving}>
      <div className="flex items-center gap-4 rounded-xl border border-line bg-surface p-4">
        <Trash2 className="shrink-0 text-muted" size={20} aria-hidden="true" />
        <div className="min-w-0"><p className="break-words font-medium text-ink">{bill.name}</p><p className="mt-1 text-sm text-muted">{formatMoney(bill.amount_cents)}</p></div>
      </div>
      {error && <p role="alert" className="mt-4 rounded-lg bg-danger/10 p-3 text-sm leading-6 text-danger">{error}</p>}
      <div className="dialog-actions">
        <button data-initial-focus type="button" className="secondary-button" onClick={onClose} disabled={saving}>Cancelar</button>
        <button type="button" className="danger-button" disabled={saving} onClick={() => void handleDelete()}>
          {saving && <LoaderCircle size={17} className="animate-spin" aria-hidden="true" />}
          {saving ? 'Excluindo…' : 'Excluir conta'}
        </button>
      </div>
    </Dialog>
  )
}
