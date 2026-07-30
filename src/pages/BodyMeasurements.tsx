import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CalendarDays, Copy, PencilLine, Plus, Ruler, Trash2, X } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useAuth } from '../hooks/useAuth'
import { EvolutionTabs } from './Evolution'
import { circumferenceFields, compareBodyMeasurements, validateBodyMeasurementInput, type BodyMeasurementInput, type CircumferenceField } from '../lib/evolution'
import { localIsoDate } from '../lib/dates'
import type { BodyMeasurement } from '../lib/types'
import { evolutionService } from '../services/evolution-service'

type Range = '30' | '90' | 'all'
type MeasurementEditor = { mode: 'new' | 'edit'; initial?: BodyMeasurement } | null
type MeasurementDraft = Record<string, string>

const fields: { field: CircumferenceField; label: string }[] = [
  { field: 'neckCm', label: 'Pescoço' },
  { field: 'shouldersCm', label: 'Ombros' },
  { field: 'chestCm', label: 'Peitoral' },
  { field: 'waistCm', label: 'Cintura' },
  { field: 'abdomenCm', label: 'Abdômen' },
  { field: 'hipCm', label: 'Quadril' },
  { field: 'leftArmRelaxedCm', label: 'Braço esquerdo relaxado' },
  { field: 'rightArmRelaxedCm', label: 'Braço direito relaxado' },
  { field: 'leftArmContractedCm', label: 'Braço esquerdo contraído' },
  { field: 'rightArmContractedCm', label: 'Braço direito contraído' },
  { field: 'leftForearmCm', label: 'Antebraço esquerdo' },
  { field: 'rightForearmCm', label: 'Antebraço direito' },
  { field: 'leftThighCm', label: 'Coxa esquerda' },
  { field: 'rightThighCm', label: 'Coxa direita' },
  { field: 'leftCalfCm', label: 'Panturrilha esquerda' },
  { field: 'rightCalfCm', label: 'Panturrilha direita' },
]

const fieldLabels = Object.fromEntries(fields.map(({ field, label }) => [field, label])) as Record<CircumferenceField, string>
const rangeLabels: Record<Range, string> = { '30': '30 dias', '90': '3 meses', all: 'Tudo' }

function formatValue(value: number | null | undefined, digits = 1) {
  return value == null ? '—' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: digits }).format(value)
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${date}T12:00:00`))
}

function withinRange(date: string, range: Range) {
  if (range === 'all') return true
  const from = new Date(`${localIsoDate()}T12:00:00`).getTime() - (Number(range) - 1) * 86_400_000
  return new Date(`${date}T12:00:00`).getTime() >= from
}

function draftFrom(initial?: BodyMeasurement): MeasurementDraft {
  const draft: MeasurementDraft = { date: initial?.date ?? localIsoDate(), weightKg: initial?.weightKg == null ? '' : String(initial.weightKg), notes: initial?.notes ?? '' }
  circumferenceFields.forEach((field) => { draft[field] = initial?.[field] == null ? '' : String(initial[field]) })
  return draft
}

export function BodyMeasurements() {
  const { user } = useAuth()
  const userId = user?.uid
  const client = useQueryClient()
  const [range, setRange] = useState<Range>('all')
  const [chartField, setChartField] = useState<CircumferenceField>('waistCm')
  const [editor, setEditor] = useState<MeasurementEditor>(null)
  const [deleting, setDeleting] = useState<BodyMeasurement | null>(null)
  const measurements = useQuery({ queryKey: ['body-measurements', userId], queryFn: () => evolutionService.listBodyMeasurements(userId!), enabled: Boolean(userId) })
  const visible = useMemo(() => (measurements.data ?? []).filter((entry) => withinRange(entry.date, range)), [measurements.data, range])
  const latest = measurements.data?.[0]
  const previous = measurements.data?.[1]
  const comparison = useMemo(() => latest && previous ? compareBodyMeasurements(latest, previous) : [], [latest, previous])
  const chartData = useMemo(() => [...visible].reverse().filter((entry) => entry[chartField] != null).map((entry) => ({ date: new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${entry.date}T12:00:00`)), value: entry[chartField] })), [chartField, visible])

  const invalidate = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['body-measurements', userId] }),
      client.invalidateQueries({ queryKey: ['weight-logs', userId] }),
      client.invalidateQueries({ queryKey: ['weight-latest', userId] }),
      client.invalidateQueries({ queryKey: ['evolution', userId] }),
    ])
  }
  const remove = useMutation({ mutationFn: (id: string) => evolutionService.deleteBodyMeasurement(userId!, id), onSuccess: async () => { await invalidate(); setDeleting(null) } })

  return <section className="evolution-page measurements-page">
    <header className="evolution-header"><div><p className="eyebrow">Evolução</p><h1 className="page-title">Medidas <span>corporais.</span></h1><p className="page-subtitle">Registre apenas o que faz sentido para você e compare números sem juízo de valor.</p></div><button className="btn btn-primary" type="button" onClick={() => setEditor({ mode: 'new' })}><Plus size={16}/> Nova medição</button></header>
    <EvolutionTabs />
    {latest ? <section className="measurements-overview"><article><span className="measurements-icon"><Ruler size={18}/></span><p>Última medição</p><h2>{formatDate(latest.date)}</h2><small>{fields.filter(({ field }) => latest[field] != null).length} medida(s) informada(s)</small></article><article><span className="measurements-icon measurements-icon-blue"><CalendarDays size={18}/></span><p>Histórico</p><h2>{measurements.data?.length ?? 0}</h2><small>registro(s) no total</small></article><article><span className="measurements-icon measurements-icon-purple"><Ruler size={18}/></span><p>Peso informado</p><h2>{latest.weightKg == null ? '—' : `${formatValue(latest.weightKg)} kg`}</h2><small>{latest.weightKg == null ? 'Não informado na última medição' : 'Não substitui o histórico de peso'}</small></article></section> : null}

    <section className="measurement-compare-card"><div className="section-title-row"><div><p className="eyebrow">Comparação</p><h2 className="section-heading">Última atualização</h2></div>{latest && <span>{formatDate(latest.date)}</span>}</div>{latest && previous ? <div className="measurement-comparison-grid">{comparison.length ? comparison.map((entry) => <article key={entry.field}><span>{entry.field === 'weightKg' ? 'Peso' : fieldLabels[entry.field]}</span><strong>{formatValue(entry.current)} <small>{entry.field === 'weightKg' ? 'kg' : 'cm'}</small></strong><p>Anterior: {formatValue(entry.previous)} · Variação de {entry.difference > 0 ? '+' : ''}{formatValue(entry.difference)} {entry.field === 'weightKg' ? 'kg' : 'cm'}{entry.percentageDifference == null ? '' : ` (${entry.percentageDifference > 0 ? '+' : ''}${formatValue(entry.percentageDifference)}%)`}</p></article>) : <p className="measurement-empty">As duas últimas medições não têm campos em comum para comparar.</p>}</div> : <EmptyMeasurements onCreate={() => setEditor({ mode: 'new' })} compact={Boolean(latest)} />}</section>

    <section className="measurement-chart-card"><div className="section-title-row"><div><p className="eyebrow">Gráfico</p><h2 className="section-heading">Acompanhar uma medida</h2></div><label className="select-filter"><span>Medida</span><select value={chartField} onChange={(event) => setChartField(event.target.value as CircumferenceField)}>{fields.map(({ field, label }) => <option value={field} key={field}>{label}</option>)}</select></label></div>{chartData.length >= 2 ? <div className="measurement-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}><CartesianGrid vertical={false} stroke="#e4ece6" strokeDasharray="3 4"/><XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: '#809089', fontSize: 10 }}/><YAxis tickLine={false} axisLine={false} tick={{ fill: '#809089', fontSize: 10 }}/><Tooltip formatter={(value) => [`${formatValue(Number(value))} cm`, fieldLabels[chartField]]} contentStyle={{ border: '1px solid #dce9e0', borderRadius: 12, fontSize: 12 }}/><Line type="monotone" dataKey="value" stroke="#6d79cb" strokeWidth={3} dot={{ r: 4, fill: '#fff', stroke: '#6d79cb', strokeWidth: 2 }}/></LineChart></ResponsiveContainer></div> : <p className="measurement-empty">São necessários ao menos dois registros dessa medida para desenhar o gráfico.</p>}</section>

    <section className="evolution-history"><div className="section-title-row"><div><p className="eyebrow">Histórico completo</p><h2 className="section-heading">Todas as medições</h2></div><div className="range-tabs">{(Object.keys(rangeLabels) as Range[]).map((value) => <button type="button" key={value} className={range === value ? 'range-active' : ''} onClick={() => setRange(value)}>{rangeLabels[value]}</button>)}</div></div>{measurements.isLoading ? <p className="section-loading">Carregando medidas…</p> : visible.length ? <div className="measurement-history-list">{visible.map((entry) => <article className="measurement-history-row" key={entry.id}><div><strong>{formatDate(entry.date)}</strong><span>{measurementSummary(entry)}</span>{entry.notes && <small>{entry.notes}</small>}</div><div className="measurement-history-actions"><button type="button" aria-label={`Duplicar medição de ${formatDate(entry.date)}`} onClick={() => setEditor({ mode: 'new', initial: { ...entry, date: localIsoDate() } })}><Copy size={15}/></button><button type="button" aria-label={`Editar medição de ${formatDate(entry.date)}`} onClick={() => setEditor({ mode: 'edit', initial: entry })}><PencilLine size={15}/></button><button type="button" aria-label={`Excluir medição de ${formatDate(entry.date)}`} className="is-danger" onClick={() => setDeleting(entry)}><Trash2 size={15}/></button></div></article>)}</div> : <EmptyMeasurements onCreate={() => setEditor({ mode: 'new' })} />}</section>
    <MeasurementEditorDialog key={editor ? `${editor.mode}-${editor.initial?.id ?? 'new'}` : 'closed'} editor={editor} userId={userId} previous={editor?.mode === 'new' ? measurements.data?.[0] : measurements.data?.find((entry) => entry.id !== editor?.initial?.id)} onClose={() => setEditor(null)} onSaved={async () => { await invalidate(); setEditor(null) }} />
    <ConfirmDialog open={Boolean(deleting)} title="Excluir esta medição?" description="Esta ação remove apenas a medição selecionada. Registros de peso vinculados não são excluídos automaticamente." confirmLabel="Excluir medição" danger isConfirming={remove.isPending} onCancel={() => setDeleting(null)} onConfirm={() => { if (deleting) remove.mutate(deleting.id) }} />
  </section>
}

function MeasurementEditorDialog({ editor, userId, previous, onClose, onSaved }: { editor: MeasurementEditor; userId?: string; previous?: BodyMeasurement; onClose: () => void; onSaved: () => Promise<void> }) {
  const [draft, setDraft] = useState<MeasurementDraft>(() => draftFrom(editor?.initial))
  const [registerWeight, setRegisterWeight] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: async () => {
      if (!userId || !editor) throw new Error('Sua sessão não está disponível.')
      const input = draft as unknown as Partial<BodyMeasurementInput>
      const validation = validateBodyMeasurementInput(input)
      if (!validation.ok) throw new Error(validation.errors.map((item) => item.message).join(' '))
      if (editor.mode === 'edit' && editor.initial) await evolutionService.updateBodyMeasurement(userId, editor.initial.id, validation.value, { registerWeight })
      else await evolutionService.createBodyMeasurement(userId, validation.value, { registerWeight })
    },
    onSuccess: () => onSaved(),
    onError: (reason) => setError(reason instanceof Error ? reason.message : 'Não foi possível salvar a medição.'),
  })
  if (!editor) return null
  const update = (key: string, value: string) => setDraft((current) => ({ ...current, [key]: value }))
  const changes = editor.mode === 'new' && previous ? changedDraftFields(draft, previous) : []
  return <div className="editor-backdrop" role="presentation" onMouseDown={onClose}><section className="measurement-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="measurement-editor-title" onMouseDown={(event) => event.stopPropagation()}><button className="editor-close" type="button" aria-label="Fechar" onClick={onClose} disabled={save.isPending}><X size={17}/></button><p className="eyebrow">Medidas corporais</p><h2 id="measurement-editor-title">{editor.mode === 'edit' ? 'Editar medição' : editor.initial ? 'Duplicar como nova medição' : 'Nova medição'}</h2><p className="editor-helper">Preencha uma ou várias circunferências. Nenhum campo é assumido como zero.</p><div className="measurement-editor-grid"><FormField label="Data"><input className="field" type="date" value={draft.date} max={localIsoDate()} onChange={(event) => update('date', event.target.value)} /></FormField><FormField label="Peso opcional (kg)"><input className="field" inputMode="decimal" value={draft.weightKg} onChange={(event) => update('weightKg', event.target.value)} placeholder="Ex.: 72,5" /></FormField></div><fieldset className="measurement-fieldset"><legend>Circunferências (cm)</legend><div className="measurement-editor-grid">{fields.map(({ field, label }) => <FormField key={field} label={label}><input className="field" inputMode="decimal" value={draft[field]} onChange={(event) => update(field, event.target.value)} placeholder="Opcional" /></FormField>)}</div></fieldset><FormField label="Observações"><textarea className="field" rows={3} value={draft.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Opcional" /></FormField>{draft.weightKg.trim() && <label className="weight-checkbox"><input type="checkbox" checked={registerWeight} onChange={(event) => setRegisterWeight(event.target.checked)} /> Também registrar este peso no histórico</label>}{changes.length > 0 && <p className="measurement-change-hint">Campos diferentes da medição anterior: {changes.join(', ')}.</p>}{error && <p className="form-error" role="alert">{error}</p>}<footer className="editor-actions"><button className="btn btn-soft" type="button" onClick={onClose} disabled={save.isPending}>Cancelar</button><button className="btn btn-primary" type="button" onClick={() => { setError(null); save.mutate() }} disabled={save.isPending}>{save.isPending ? 'Salvando…' : 'Salvar medição'}</button></footer></section></div>
}

function changedDraftFields(draft: MeasurementDraft, previous: BodyMeasurement) {
  return fields.flatMap(({ field, label }) => {
    if (!draft[field].trim() || previous[field] == null) return []
    return Number(draft[field].replace(',', '.')) !== previous[field] ? [label] : []
  })
}

function measurementSummary(entry: BodyMeasurement) {
  const values = fields.flatMap(({ field, label }) => entry[field] == null ? [] : [`${label}: ${formatValue(entry[field])} cm`])
  if (entry.weightKg != null) values.unshift(`Peso: ${formatValue(entry.weightKg)} kg`)
  return values.length ? values.slice(0, 4).join(' · ') + (values.length > 4 ? '…' : '') : 'Sem medidas numéricas'
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="form-label">{label}{children}</label>
}

function EmptyMeasurements({ onCreate, compact = false }: { onCreate: () => void; compact?: boolean }) {
  return <div className={`evolution-empty ${compact ? 'evolution-empty-compact' : ''}`}><span><Ruler size={24}/></span><h3>{compact ? 'Registre uma segunda medição para comparar.' : 'Ainda não há medidas corporais.'}</h3>{!compact && <p>Você pode começar com uma única medida, como cintura ou quadril.</p>}<button className="btn btn-soft" type="button" onClick={onCreate}><Plus size={15}/> Nova medição</button></div>
}
