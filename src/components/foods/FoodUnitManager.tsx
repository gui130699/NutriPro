import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, PencilLine, Plus, RotateCcw, Star, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ConfirmDialog } from '../ConfirmDialog'
import { FoodUnitProfileDialog } from './FoodUnitProfileDialog'
import { catalogUnitSuggestions } from '../../lib/food-units'
import type { Food, FoodDensityProfileDraft, FoodSource, FoodUnitProfile, FoodUnitProfileDraft } from '../../lib/types'
import { nutritionService } from '../../services/nutrition-service'

type ConfirmProfileAction = { kind: 'delete' | 'deactivate'; profile: FoodUnitProfile } | null

export function FoodUnitManager({ food, userId }: { food: Food; userId?: string }) {
  const client = useQueryClient()
  const source: FoodSource = food.isPublic ? 'public' : 'private'
  const [editor, setEditor] = useState<FoodUnitProfile | 'new' | null>(null)
  const [confirm, setConfirm] = useState<ConfirmProfileAction>(null)
  const profiles = useQuery({
    queryKey: ['food-unit-profiles', userId, food.id, source, 'all'],
    queryFn: () => nutritionService.foodUnitProfiles(userId!, food.id, source, { includeInactive: true }),
    enabled: Boolean(userId),
  })
  const invalidate = () => client.invalidateQueries({ queryKey: ['food-unit-profiles', userId, food.id, source] })
  const activeProfiles = useMemo(() => (profiles.data ?? []).filter((profile) => profile.isActive), [profiles.data])
  const catalogSuggestions = useMemo(() => catalogUnitSuggestions(food, source), [food, source])

  const save = useMutation({
    mutationFn: async ({ draft, replacesProfileId }: { draft: FoodUnitProfileDraft; replacesProfileId?: string | null }) =>
      nutritionService.saveFoodUnitProfile(userId!, draft, { replacesProfileId }),
    onSuccess: async () => { await invalidate(); setEditor(null) },
  })
  const state = useMutation({
    mutationFn: async ({ profile, active }: { profile: FoodUnitProfile; active: boolean }) => active
      ? nutritionService.restoreFoodUnitProfile(userId!, profile.id)
      : nutritionService.deactivateFoodUnitProfile(userId!, profile.id),
    onSuccess: invalidate,
  })
  const defaultProfile = useMutation({
    mutationFn: (profile: FoodUnitProfile) => nutritionService.setDefaultFoodUnitProfile(userId!, profile.id),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (profile: FoodUnitProfile) => nutritionService.deleteFoodUnitProfile(userId!, profile.id, true),
    onSuccess: async () => { await invalidate(); setConfirm(null) },
  })

  const duplicate = (profile: FoodUnitProfile) => {
    const existingNames = new Set((profiles.data ?? []).map((item) => item.name.trim().toLocaleLowerCase('pt-BR')))
    const baseName = `${profile.name} (cópia)`
    let copyName = baseName
    let copyIndex = 2
    while (existingNames.has(copyName.toLocaleLowerCase('pt-BR'))) {
      copyName = `${profile.name} (cópia ${copyIndex})`
      copyIndex += 1
    }
    const draft: FoodUnitProfileDraft = {
      foodId: food.id,
      foodSource: source,
      name: copyName,
      singularLabel: copyName,
      pluralLabel: profile.pluralLabel ?? null,
      measureType: profile.measureType,
      baseMeasure: profile.baseMeasure,
      amountPerUnit: profile.amountPerUnit,
      isDefault: false,
      isActive: true,
      origin: 'user',
      notes: profile.notes ?? null,
    }
    save.mutate({ draft })
  }

  if (!userId) return null
  return <section className="food-unit-manager" aria-label={`Unidades e porções de ${food.name}`}>
    <div className="food-unit-manager-head"><div><h3>Unidades e porções</h3><p>Estas medidas são só suas e não alteram o catálogo público.</p></div><button type="button" className="btn btn-soft" onClick={() => setEditor('new')}><Plus size={15} /> Nova medida</button></div>
    {profiles.isLoading ? <p className="food-unit-empty">Carregando medidas…</p> : !profiles.data?.length ? <div className="food-unit-empty"><p>Nenhuma medida pessoal salva.</p><button type="button" onClick={() => setEditor('new')}>Criar a primeira medida</button></div> : <div className="food-unit-profile-list">
      {(profiles.data ?? []).map((profile) => <article key={profile.id} className={`food-unit-profile-row ${profile.isActive ? '' : 'is-inactive'}`}>
        <div><strong>{profile.name} {profile.isDefault && <span className="food-unit-default-badge"><Star size={11} fill="currentColor" /> Padrão</span>}</strong><small>{profile.amountPerUnit.toLocaleString('pt-BR')} {profile.baseMeasure} por {profile.singularLabel} · {profile.isActive ? 'Ativa' : 'Desativada'}{profile.syncStatus === 'pending' ? ' · Aguardando sincronização' : ''}</small></div>
        <div className="food-unit-row-actions">
          {profile.isActive && !profile.isDefault && <button type="button" title="Tornar padrão" aria-label={`Tornar ${profile.name} padrão`} onClick={() => defaultProfile.mutate(profile)}><Check size={14} /></button>}
          <button type="button" title="Editar" aria-label={`Editar ${profile.name}`} onClick={() => setEditor(profile)}><PencilLine size={14} /></button>
          <button type="button" title="Duplicar" aria-label={`Duplicar ${profile.name}`} onClick={() => duplicate(profile)} disabled={save.isPending}><Copy size={14} /></button>
          {profile.isActive ? <button type="button" title="Desativar" aria-label={`Desativar ${profile.name}`} onClick={() => setConfirm({ kind: 'deactivate', profile })}><Trash2 size={14} /></button> : <button type="button" title="Restaurar" aria-label={`Restaurar ${profile.name}`} onClick={() => state.mutate({ profile, active: true })}><RotateCcw size={14} /></button>}
          {!profile.isActive && <button type="button" className="is-danger" title="Excluir definitivamente" aria-label={`Excluir ${profile.name}`} onClick={() => setConfirm({ kind: 'delete', profile })}><Trash2 size={14} /></button>}
        </div>
      </article>)}
    </div>}
    {catalogSuggestions.length > 0 && <p className="food-unit-catalog-hint">Sugestões do catálogo: {catalogSuggestions.map((suggestion) => `${suggestion.name} (${suggestion.amountPerUnit.toLocaleString('pt-BR')} ${suggestion.baseMeasure})`).join(' · ')}. Elas não são gravadas na sua conta e podem ser usadas ou personalizadas no diário.</p>}
    <FoodDensityPanel food={food} userId={userId} source={source} />
    {save.error && <p className="form-error">{save.error instanceof Error ? save.error.message : 'Não foi possível salvar a medida.'}</p>}
    <FoodUnitProfileDialog open={Boolean(editor)} food={food} foodSource={source} profile={editor === 'new' ? null : editor} defaultChecked={!activeProfiles.some((profile) => profile.isDefault)} allowTemporary={false} saving={save.isPending} onClose={() => setEditor(null)} onSave={async (draft) => { await save.mutateAsync({ draft, replacesProfileId: editor === 'new' ? null : editor?.id }) }} />
    <ConfirmDialog open={Boolean(confirm)} title={confirm?.kind === 'delete' ? 'Excluir medida definitivamente?' : 'Desativar medida?'} description={confirm?.kind === 'delete' ? 'Ela será excluída apenas se não existir em lançamentos anteriores. Caso contrário, ficará desativada para preservar o histórico.' : 'Ela deixará de aparecer em novos lançamentos, mas o histórico já registrado continua intacto.'} confirmLabel={confirm?.kind === 'delete' ? 'Excluir medida' : 'Desativar medida'} danger isConfirming={remove.isPending || state.isPending} onCancel={() => setConfirm(null)} onConfirm={() => confirm && (confirm.kind === 'delete' ? remove.mutate(confirm.profile) : state.mutate({ profile: confirm.profile, active: false }))} />
  </section>
}

function FoodDensityPanel({ food, userId, source }: { food: Food; userId: string; source: FoodSource }) {
  const client = useQueryClient()
  const density = useQuery({
    queryKey: ['food-density-profile', userId, food.id, source],
    queryFn: () => nutritionService.foodDensityProfile(userId, food.id, source),
  })
  const [amount, setAmount] = useState('')
  const [densitySource, setDensitySource] = useState<FoodDensityProfileDraft['source']>('label')
  useEffect(() => {
    if (!density.data) return
    setAmount(String(density.data.gramsPerMl).replace('.', ','))
    setDensitySource(density.data.source)
  }, [density.data])
  const save = useMutation({
    mutationFn: () => nutritionService.saveFoodDensityProfile(userId, { foodId: food.id, foodSource: source, gramsPerMl: amount, source: densitySource }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['food-density-profile', userId, food.id, source] }),
  })
  const remove = useMutation({
    mutationFn: () => nutritionService.deleteFoodDensityProfile(userId, food.id, source),
    onSuccess: () => client.invalidateQueries({ queryKey: ['food-density-profile', userId, food.id, source] }),
  })
  return <section className="food-density-panel">
    <div><strong>Densidade (opcional)</strong><p>Conversões entre g e ml só são permitidas com uma densidade explícita; nunca usamos 1 ml = 1 g por suposição.</p></div>
    <div className="food-density-form"><input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="g por ml" aria-label="Densidade em gramas por mililitro" /><select value={densitySource} onChange={(event) => setDensitySource(event.target.value as FoodDensityProfileDraft['source'])} aria-label="Fonte da densidade"><option value="label">Rótulo</option><option value="user">Informada por mim</option><option value="professional">Profissional</option></select><button type="button" className="btn btn-soft" disabled={save.isPending || !amount.trim()} onClick={() => save.mutate()}>Salvar</button>{density.data && <button type="button" className="food-density-remove" disabled={remove.isPending} onClick={() => remove.mutate()}>Remover</button>}</div>
    {density.data?.syncStatus === 'pending' && <small>Aguardando sincronização.</small>}
    {save.error && <p className="form-error">{save.error instanceof Error ? save.error.message : 'Não foi possível salvar a densidade.'}</p>}
  </section>
}
