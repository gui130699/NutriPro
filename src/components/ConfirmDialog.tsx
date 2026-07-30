import { AlertTriangle, X } from 'lucide-react'
import type { ReactNode } from 'react'

type ConfirmDialogProps = {
  open: boolean
  title: string
  description: ReactNode
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
  isConfirming?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({ open, title, description, confirmLabel, cancelLabel = 'Cancelar', danger = false, isConfirming = false, onCancel, onConfirm }: ConfirmDialogProps) {
  if (!open) return null
  return <div className="dialog-backdrop" role="presentation" onMouseDown={onCancel}>
    <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
      <button className="dialog-close" type="button" aria-label="Fechar" onClick={onCancel}><X size={17}/></button>
      <span className={`dialog-icon ${danger ? 'dialog-icon-danger' : ''}`}><AlertTriangle size={19}/></span>
      <h2 id="confirm-dialog-title">{title}</h2>
      <div className="dialog-description">{description}</div>
      <footer><button className="btn btn-soft" type="button" onClick={onCancel} disabled={isConfirming}>{cancelLabel}</button><button className={`btn ${danger ? 'btn-danger-solid' : 'btn-primary'}`} type="button" onClick={onConfirm} disabled={isConfirming}>{isConfirming ? 'Aguarde…' : confirmLabel}</button></footer>
    </section>
  </div>
}
