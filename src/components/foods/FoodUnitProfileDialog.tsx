import { Clock3, Save, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
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
  defaultChecked = false,
  allowTemporary = true,
  saving = false,
  onClose,
  onSave,
  onUseTemporary,
}: FoodUnitProfileDialogProps) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [isDefault, setIsDefault] = useState(defaultChecked)
  const [error, setError] = useState<string | null>(null)
  const baseMeasure = food?.baseUnit ?? 'g'
  const suggestions = useMemo(() => [...new Set(categorySuggestions(food?.category))], [food?.category])

  useEffect(() => {
    if (!open) return
    setName(profile?.name ?? '')
    setAmount(profile ? String(profile.amountPerUnit).replace('.', ',') : '')
    setIsDefault(profile?.isDefault ?? defaultChecked)
    setError(null)
  }, [defaultChecked, open, profile])

  if (!open || !food) return null

  const makeDraft = (): FoodUnitProfileDraft => ({
    foodId: food.id,
    foodSource,
    name,
    singularLabel: name,
    pluralLabel: null,
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
  return <div className="editor-backdrop unit-dialog-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="food-unit-dialog" role="dialog" aria-modal="true" aria-labelledby="food-unit-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
      <button type="button" className="editor-close" aria-label="Fechar medida" onClick={onClose}><X size={18} /></button>
      <p className="eyebrow">Medida personalizada</p>
      <h2 id="food-unit-dialog-title">{verb} para {food.name}</h2>
      <p className="editor-helper">Informe quanto esta medida representa em <strong>{baseMeasure}</strong>. Não estimamos peso automaticamente.</p>

      <div className="food-unit-form">
        <label><span>Nome da unidade</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: unidade média" maxLength={120} /></label>
        <label><span>Quantidade por unidade ({baseMeasure})</span><input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder={`Ex.: 80 ${baseMeasure}`} aria-label={`Quantidade em ${baseMeasure}`} /></label>
        <div className="food-unit-suggestions"><span>Sugestões de nome</span><div>{suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => setName(suggestion)}>{suggestion}</button>)}</div></div>
        <label className="food-unit-default"><input type="checkbox" checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} /> Tornar esta a medida padrão deste alimento</label>
        {error && <p className="form-error">{error}</p>}
      </div>

      <footer className="food-unit-dialog-actions">
        <button type="button" className="btn btn-soft" onClick={onClose} disabled={saving}>Cancelar</button>
        {allowTemporary && onUseTemporary && <button type="button" className="btn btn-ghost" onClick={() => void run('temporary')} disabled={saving}><Clock3 size={16} /> Usar só desta vez</button>}
        <button type="button" className="btn btn-primary" onClick={() => void run('save')} disabled={saving}><Save size={16} /> {saving ? 'Salvando…' : 'Salvar para as próximas vezes'}</button>
      </footer>
    </section>
  </div>
}
