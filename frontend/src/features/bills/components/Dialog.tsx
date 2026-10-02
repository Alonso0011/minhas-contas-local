import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface DialogProps {
  title: string
  description?: string
  busy?: boolean
  children: ReactNode
  onClose: () => void
}

export function Dialog({ title, description, busy = false, children, onClose }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current!
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    dialog.querySelector<HTMLElement>('[data-initial-focus]')?.focus()
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus()
      else document.getElementById('new-bill-button')?.focus()
    }
  }, [])

  return (
    <dialog
      ref={ref}
      aria-labelledby="dialog-title"
      aria-describedby={description ? 'dialog-description' : undefined}
      className="modal"
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]')]
          .filter(element => element.getClientRects().length > 0)
        const first = controls[0]
        const last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }}
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}
      onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}
    >
      <div className="p-6 sm:p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 id="dialog-title" className="text-xl font-semibold tracking-tight text-ink">{title}</h2>
            {description && <p id="dialog-description" className="mt-2 text-sm leading-6 text-muted">{description}</p>}
          </div>
          <button type="button" className="icon-button -mr-2 -mt-1 shrink-0" aria-label="Fechar janela" onClick={onClose} disabled={busy}>
            <X size={19} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  )
}
