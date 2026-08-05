import { Clock3, Save, X } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'
import { validateFoodUnitProfileDraft } from '../../lib/food-units'
import type { Food, FoodSource, FoodUnitProfile, FoodUnitProfileDraft, TemporaryFoodUnit } from '../../lib/types'

const genericSuggestions = [
  'unidade pequena', 'unidade média', 'unidade grande', 'fatia', 'pedaço',
  'colher de chá', 'colher de sopa', 'concha', 'xícara', 'copo', 'caneca',
  'pacote', 'porção', 'dose', 'filé', 'bife', 'ovo', 'fruta',
]

const categorySuggestions = (category?: string | null) => {
  const normalized = (category ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (/(bebida|leite|iogurte)/.test(normalized)) return ['copo', 'caneca', 'xícara', 'dose', ...genericSuggestions]
  if (/(carne|pescado|frango)/.test(normalized)) return ['filé', 'bife', 'pedaço', 'porção', ...genericSuggestions]
  if (/(fruta)/.test(normalized)) return ['fruta', 'unidade pequena', 'unidade média', 'unidade grande', ...genericSuggestions]
  return genericSuggestions
}

export type FoodUnitProfileDialogProps = {
  open: boolean
  food: Food | null
  foodSource: FoodSource
  profile?: FoodUnitProfile | null
  initialName?: string
  defaultChecked?: boolean
  allowTemporary?: boolean
  saving?: boolean
  onClose: () => void
  onSave: (draft: FoodUnitProfileDraft) => Promise<void> | void
  onUseTemporary?: (unit: TemporaryFoodUnit) => Promise<void> | void
}

/**
 * Shared form for a one-off household measure and a user-owned saved profile.
 * It never supplies a suggested weight: the amount is always entered by the
 * person recording the food.
 */
export function FoodUnitProfileDialog({
  open,
  food,
  foodSource,
  profile,
  initialName = '',
  defaultChecked = false,
  allowTemporary = true,
  saving = false,
  onClose,
  onSave,
  onUseTemporary,
}: FoodUnitProfileDialogProps) {
  const [name, setName] = useState('')
  const [singularLabel, setSingularLabel] = useState('')
  const [pluralLabel, setPluralLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [isDefault, setIsDefault] = useState(defaultChecked)
  const [error, setError] = useState<string | null>(null)
  const helpId = useId()
  const errorId = useId()
  const baseMeasure = food?.baseUnit ?? 'g'
  const suggestions = useMemo(() => [...new Set(categorySuggestions(food?.category))], [food?.category])

  useEffect(() => {
    if (!open) return
    const nextName = profile?.name ?? initialName
    setName(nextName)
    setSingularLabel(profile?.singularLabel ?? nextName)
    setPluralLabel(profile?.pluralLabel ?? '')
    setAmount(profile ? String(profile.amountPerUnit).replace('.', ',') : '')
    setIsDefault(profile?.isDefault ?? defaultChecked)
    setError(null)
  }, [defaultChecked, initialName, open, profile])

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose, open])

  if (!open || !food) return null

  const makeDraft = (): FoodUnitProfileDraft => ({
    foodId: food.id,
    foodSource,
    name,
    singularLabel,
    pluralLabel: pluralLabel || null,
    measureType: baseMeasure === 'g' ? 'mass' : 'volume',
    baseMeasure,
    amountPerUnit: amount,
    isDefault,
    isActive: true,
    origin: 'user',
  })

  const run = async (action: 'save' | 'temporary') => {
    setError(null)
    try {
      if (action === 'save') {
        await onSave(makeDraft())
      } else {
        if (!onUseTemporary) return
        // Keep the temporary option subject to exactly the same input rules as
        // a saved profile, without creating a Firestore document.
        const validated = validateFoodUnitProfileDraft(makeDraft())
        const temporary: TemporaryFoodUnit = {
          name: validated.name,
          singularLabel: validated.singularLabel,
          amountPerUnit: validated.amountPerUnit,
          baseMeasure: validated.baseMeasure,
        }
        await onUseTemporary(temporary)
      }
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar esta medida.')
    }
  }

  const verb = profile ? 'Editar medida' : 'Informar medida'
  const amountQuestion = baseMeasure === 'g'
    ? `Quantos gramas tem ${initialName === 'porção' ? 'uma porção' : 'uma unidade'} de “${food.name}”?`
    : `Quantos mililitros tem ${initialName === 'porção' ? 'uma porção' : 'uma unidade ou recipiente'} de “${food.name}”?`
  return <div className="editor-backdrop unit-dialog-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="food-unit-dialog" role="dialog" aria-modal="true" aria-labelledby="food-unit-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
      <button type="button" className="editor-close" aria-label="Fechar medida" onClick={onClose}><X size={18} /></button>
      <p className="eyebrow">Medida personalizada</p>
      <h2 id="food-unit-dialog-title">{verb} para {food.name}</h2>
      <p className="editor-helper" id={helpId}>{amountQuestion} Não estimamos peso ou volume automaticamente.</p>

      <div className="food-unit-form">
        <label><span>Nome da medida</span><input autoFocus value={name} onChange={(event) => { setName(event.target.value); if (!singularLabel || singularLabel === name) setSingularLabel(event.target.value) }} placeholder="Ex.: unidade média" maxLength={120} aria-describedby={helpId} /></label>
        <label><span>Peso ou volume ({baseMeasure})</span><input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder={`Ex.: 80 ${baseMeasure}`} aria-label={`Peso ou volume em ${baseMeasure}`} aria-describedby={`${helpId}${error ? ` ${errorId}` : ''}`} /></label>
        <label><span>Unidade-base</span><input value={baseMeasure} readOnly aria-label="Unidade-base da medida" /></label>
        <label><span>Rótulo singular</span><input value={singularLabel} onChange={(event) => setSingularLabel(event.target.value)} placeholder="Ex.: banana média" maxLength={120} /></label>
        <label><span>Rótulo plural</span><input value={pluralLabel} onChange={(event) => setPluralLabel(event.target.value)} placeholder="Ex.: bananas médias" maxLength={120} /></label>
        <div className="food-unit-suggestions"><span>Sugestões de nome</span><div>{suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => setName(suggestion)}>{suggestion}</button>)}</div></div>
        <label className="food-unit-default"><input type="checkbox" checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} /> Tornar esta a medida padrão deste alimento</label>
        {error && <p className="form-error" id={errorId} role="alert" aria-live="assertive">{error}</p>}
      </div>

      <footer className="food-unit-dialog-actions">
        <button type="button" className="btn btn-soft" onClick={onClose} disabled={saving}>Cancelar</button>
        {allowTemporary && onUseTemporary && <button type="button" className="btn btn-ghost" onClick={() => void run('temporary')} disabled={saving}><Clock3 size={16} /> Usar só desta vez</button>}
        <button type="button" className="btn btn-primary" onClick={() => void run('save')} disabled={saving}><Save size={16} /> {saving ? 'Salvando…' : 'Salvar para as próximas vezes'}</button>
      </footer>
    </section>
  </div>
}
