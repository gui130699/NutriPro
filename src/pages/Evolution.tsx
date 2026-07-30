import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, CalendarDays, ChartNoAxesCombined, CircleGauge, PencilLine, Plus, Scale, Target, Trash2, TrendingDown, TrendingUp, X } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useAuth } from '../hooks/useAuth'
import { calculateWeightSummary, validateWeightLogInput, type WeightLogInput } from '../lib/evolution'
import { localIsoDate } from '../lib/dates'
import type { WeightLog, WeightLogSource } from '../lib/types'
import { evolutionService } from '../services/evolution-service'
import { nutritionService } from '../services/nutrition-service'

type Range = '7' | '30' | '90' | 'all'
type WeightEditor = WeightLog | 'new' | null

const rangeLabels: Record<Range, string> = { '7': '7 dias', '30': '30 dias', '90': '3 meses', all: 'Tudo' }
const sourceLabels: Record<WeightLogSource, string> = {
  onboarding: 'Onboarding',
  profile: 'Perfil',
  evolution: 'Evolução',
  assessment: 'Avaliação física',
  measurement: 'Medidas corporais',
}

const toDisplay = (value: number | null | undefined, digits = 1) => value == null
  ? '—'
  : new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: digits }).format(value)

const dayDiff = (value: string, now = localIsoDate()) => {
  const target = new Date(`${value}T12:00:00`).getTime()
  const reference = new Date(`${now}T12:00:00`).getTime()
  return Math.round((reference - target) / 86_400_000)
}

export function EvolutionTabs() {
  return <nav className="evolution-tabs" aria-label="Seções de evolução">
    <NavLink to="/evolucao" end><Scale size={15} /> Peso</NavLink>
    <NavLink to="/evolucao/medidas"><Activity size={15} /> Medidas corporais</NavLink>
    <NavLink to="/evolucao/avaliacao-fisica"><ChartNoAxesCombined size={15} /> Avaliação física</NavLink>
  </nav>
}

export function Evolution() {
  const { user } = useAuth()
  const userId = user?.uid
  const client = useQueryClient()
  const [range, setRange] = useState<Range>('30')
  const [editor, setEditor] = useState<WeightEditor>(null)
  const [deleting, setDeleting] = useState<WeightLog | null>(null)
  const weights = useQuery({ queryKey: ['weight-logs', userId], queryFn: () => evolutionService.listWeights(userId!), enabled: Boolean(userId) })
  const goals = useQuery({ queryKey: ['goals', userId], queryFn: () => nutritionService.goals(userId!), enabled: Boolean(userId) })
  const measurements = useQuery({ queryKey: ['body-measurements', userId], queryFn: () => evolutionService.listBodyMeasurements(userId!), enabled: Boolean(userId) })
  const assessments = useQuery({ queryKey: ['physical-assessments', userId], queryFn: () => evolutionService.listPhysicalAssessments(userId!), enabled: Boolean(userId) })

  const summary = useMemo(() => calculateWeightSummary(weights.data ?? [], goals.data?.weightGoalKg), [goals.data?.weightGoalKg, weights.data])
  const chartLogs = useMemo(() => {
    const days = range === 'all' ? Number.POSITIVE_INFINITY : Number(range)
    return (weights.data ?? []).filter((entry) => dayDiff(entry.date) <= days - 1 && dayDiff(entry.date) >= 0)
  }, [range, weights.data])
  const chartData = useMemo(() => chartLogs.map((entry) => ({
    date: new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${entry.date}T12:00:00`)),
    weight: entry.weightKg,
  })), [chartLogs])

  const invalidateEvolution = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['weight-logs', userId] }),
      client.invalidateQueries({ queryKey: ['weight-latest', userId] }),
      client.invalidateQueries({ queryKey: ['profile', userId] }),
      client.invalidateQueries({ queryKey: ['evolution', userId] }),
    ])
  }

  const deleteWeight = useMutation({
    mutationFn: (id: string) => evolutionService.deleteWeight(userId!, id),
    onSuccess: async () => { await invalidateEvolution(); setDeleting(null) },
  })

  const latestMeasurement = measurements.data?.[0]
  const latestAssessment = assessments.data?.[0]

  return <section className="evolution-page">
    <header className="evolution-header"><div><p className="eyebrow">Sua jornada</p><h1 className="page-title">Veja o quanto você<br/><span>já caminhou.</span></h1><p className="page-subtitle">Histórico real, métricas transparentes e sem projeções inventadas.</p></div><button className="btn btn-primary" type="button" onClick={() => setEditor('new')}><Plus size={16}/> Novo registro</button></header>
    <EvolutionTabs />

    <section className="evolution-stats">
      <Metric icon={<CircleGauge size={17}/>} title="Peso mais recente" value={summary.latest ? `${toDisplay(summary.latest.weightKg)} kg` : 'Sem registro'} detail={summary.latest ? `Registrado em ${formatDate(summary.latest.date)}` : 'Registre sua primeira pesagem'} tone="green" />
      <Metric icon={<CalendarDays size={17}/>} title="Ponto de partida" value={summary.first ? `${toDisplay(summary.first.weightKg)} kg` : 'Sem registro'} detail={summary.totalChangeKg === null ? 'Sem comparação ainda' : `Variação total de ${formatSigned(summary.totalChangeKg)} kg`} tone="blue" />
      <Metric icon={<Target size={17}/>} title="Meta de peso" value={summary.weightGoalKg === null ? 'Não definida' : `${toDisplay(summary.weightGoalKg)} kg`} detail={goalDetail(summary.goalDeltaKg)} tone="orange" />
    </section>

    <article className="weight-chart-card">
      <div className="chart-heading"><div><p className="eyebrow">Tendência de peso</p><h2>{summary.totalChangeKg === null ? 'Ainda não há tendência' : <>Variação de <span>{formatSigned(summary.totalChangeKg)} kg</span></>}</h2></div><div className="range-tabs">{(Object.keys(rangeLabels) as Range[]).map((value) => <button className={range === value ? 'range-active' : ''} type="button" onClick={() => setRange(value)} key={value}>{rangeLabels[value]}</button>)}</div></div>
      {chartData.length ? <><div className="chart-legend"><span><i/> Peso registrado</span><p>{summary.trend === 'down' ? <><TrendingDown size={14}/> Tendência de queda</> : summary.trend === 'up' ? <><TrendingUp size={14}/> Tendência de alta</> : <><ChartNoAxesCombined size={14}/> Tendência estável</>}</p></div><div className="chart-area"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 10, right: 4, left: -25, bottom: 0 }}><defs><linearGradient id="weightFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#73bf99" stopOpacity={.35}/><stop offset="100%" stopColor="#73bf99" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#e4ece6" strokeDasharray="3 4"/><XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: '#809089', fontSize: 10 }}/><YAxis domain={['dataMin - 1', 'dataMax + 1']} tickLine={false} axisLine={false} tick={{ fill: '#809089', fontSize: 10 }}/><Tooltip formatter={(value) => [`${toDisplay(Number(value))} kg`, 'Peso']} contentStyle={{ border: '1px solid #dce9e0', borderRadius: 12, boxShadow: '0 10px 25px rgba(25,52,37,.12)', fontSize: 12 }}/><Area type="monotone" dataKey="weight" stroke="#33855f" strokeWidth={3} fill="url(#weightFill)" dot={{ r: 4, fill: '#fff', stroke: '#33855f', strokeWidth: 2 }} activeDot={{ r: 5 }}/></AreaChart></ResponsiveContainer></div></> : <EmptyState icon={<Scale size={24}/>} title="Nenhuma pesagem neste período" detail="Registre seu peso para acompanhar a evolução de forma histórica." action={() => setEditor('new')} actionLabel="Registrar peso" />}
      <footer className="chart-footer"><span><ChartNoAxesCombined size={15}/> {summary.recordCount} registro(s) · média de 7 dias: <strong>{summary.averageLast7Days === null ? '—' : `${toDisplay(summary.averageLast7Days)} kg`}</strong></span><p>Média de 30 dias: {summary.averageLast30Days === null ? '—' : `${toDisplay(summary.averageLast30Days)} kg`}</p></footer>
    </article>

    <section className="evolution-bottom">
      <article className="measurement-card"><div className="section-title-row"><div><p className="eyebrow">Medidas</p><h2 className="section-heading">Além do número na balança</h2></div><Link className="small-outline-btn" to="/evolucao/medidas">Ver todas</Link></div><div className="measurement-grid"><MeasurementSummary label="Cintura" value={latestMeasurement?.waistCm} unit="cm"/><MeasurementSummary label="Quadril" value={latestMeasurement?.hipCm} unit="cm"/><MeasurementSummary label="% gordura" value={latestAssessment?.calculatedBodyFatPercent ?? latestAssessment?.reportedBodyFatPercent} unit="%"/></div><p className="measurement-empty">{latestMeasurement ? `Última atualização em ${formatDate(latestMeasurement.date)}.` : 'Registre suas medidas para enxergar outras evoluções.'}</p></article>
      <article className="evolution-note"><span><Activity size={19}/></span><div><p className="eyebrow">Resumo do período</p><h2>{summary.lowestWeightKg === null ? 'Comece pelo primeiro registro.' : `Entre ${toDisplay(summary.lowestWeightKg)} kg e ${toDisplay(summary.highestWeightKg)} kg.`}</h2><p>{summary.percentageChange === null ? 'Com mais de um registro, o NutriPro mostra a variação percentual.' : `Variação percentual de ${formatSigned(summary.percentageChange)}%.`}</p></div></article>
    </section>

    <section className="evolution-history"><div className="section-title-row"><div><p className="eyebrow">Histórico</p><h2 className="section-heading">Todos os registros de peso</h2></div><span>{summary.recordCount} no total</span></div>{weights.isLoading ? <p className="section-loading">Carregando histórico…</p> : weights.data?.length ? <div className="weight-history-list">{[...(weights.data ?? [])].reverse().map((entry) => <article className="weight-history-row" key={entry.id}><div><strong>{toDisplay(entry.weightKg)} kg</strong><span>{formatDate(entry.date)}{entry.time ? ` · ${entry.time}` : ''}{entry.fasted ? ' · em jejum' : ''}</span>{entry.notes && <small>{entry.notes}</small>}</div><span className="weight-history-source">{sourceLabels[entry.source]}</span><div className="weight-history-actions"><button type="button" aria-label={`Editar peso de ${formatDate(entry.date)}`} onClick={() => setEditor(entry)}><PencilLine size={15}/></button><button type="button" aria-label={`Excluir peso de ${formatDate(entry.date)}`} className="is-danger" onClick={() => setDeleting(entry)}><Trash2 size={15}/></button></div></article>)}</div> : <EmptyState icon={<Scale size={24}/>} title="Seu histórico começa aqui" detail="O primeiro registro cria o ponto de partida; os próximos nunca substituem o histórico." action={() => setEditor('new')} actionLabel="Novo registro" />}</section>
    <WeightEditorDialog key={editor === 'new' ? 'new' : editor?.id ?? 'closed'} editor={editor} userId={userId} onClose={() => setEditor(null)} onSaved={async () => { await invalidateEvolution(); setEditor(null) }} />
    <ConfirmDialog open={Boolean(deleting)} title="Excluir este registro de peso?" description="Esta ação remove somente a pesagem selecionada. Os demais registros históricos permanecem intactos." confirmLabel="Excluir registro" danger isConfirming={deleteWeight.isPending} onCancel={() => setDeleting(null)} onConfirm={() => { if (deleting) deleteWeight.mutate(deleting.id) }} />
  </section>
}

function WeightEditorDialog({ editor, userId, onClose, onSaved }: { editor: WeightEditor; userId?: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const isNew = editor === 'new'
  const [draft, setDraft] = useState<Partial<WeightLogInput>>(() => editor && editor !== 'new' ? { date: editor.date, weightKg: editor.weightKg, time: editor.time, notes: editor.notes, fasted: editor.fasted, source: editor.source } : { date: localIsoDate(), weightKg: undefined, time: null, notes: null, fasted: null, source: 'evolution' })
  const [error, setError] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Sua sessão não está disponível.')
      const validation = validateWeightLogInput(draft)
      if (!validation.ok) throw new Error(validation.errors.map((entry) => entry.message).join(' '))
      if (editor && editor !== 'new') await evolutionService.updateWeight(userId, editor.id, validation.value)
      else await evolutionService.createWeight(userId, validation.value)
    },
    onSuccess: () => onSaved(),
    onError: (reason) => setError(reason instanceof Error ? reason.message : 'Não foi possível salvar o peso.'),
  })
  if (!editor) return null
  const update = <K extends keyof WeightLogInput>(key: K, value: WeightLogInput[K]) => setDraft((current) => ({ ...current, [key]: value }))
  return <div className="editor-backdrop" role="presentation" onMouseDown={onClose}><section className="weight-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="weight-editor-title" onMouseDown={(event) => event.stopPropagation()}><button className="editor-close" type="button" aria-label="Fechar" onClick={onClose} disabled={save.isPending}><X size={17}/></button><p className="eyebrow">Evolução</p><h2 id="weight-editor-title">{isNew ? 'Novo registro de peso' : 'Editar registro de peso'}</h2><p className="editor-helper">O histórico é preservado: somente este registro será alterado.</p><div className="weight-editor-grid"><Field label="Data"><input className="field" type="date" value={draft.date ?? ''} max={localIsoDate()} onChange={(event) => update('date', event.target.value)} /></Field><Field label="Peso (kg)"><input className="field" inputMode="decimal" value={draft.weightKg ?? ''} onChange={(event) => update('weightKg', event.target.value as unknown as number)} placeholder="Ex.: 72,5" autoFocus /></Field><Field label="Horário (opcional)"><input className="field" type="time" value={draft.time ?? ''} onChange={(event) => update('time', event.target.value || null)} /></Field><Field label="Origem"><select className="field" value={draft.source ?? 'evolution'} onChange={(event) => update('source', event.target.value as WeightLogSource)}>{Object.entries(sourceLabels).filter(([source]) => source !== 'onboarding').map(([source, label]) => <option value={source} key={source}>{label}</option>)}</select></Field></div><label className="weight-checkbox"><input type="checkbox" checked={Boolean(draft.fasted)} onChange={(event) => update('fasted', event.target.checked)} /> Pesagem feita em jejum</label><Field label="Observação (opcional)"><textarea className="field" rows={3} value={draft.notes ?? ''} onChange={(event) => update('notes', event.target.value || null)} placeholder="Ex.: após treino, em jejum…" /></Field>{error && <p className="form-error" role="alert">{error}</p>}<footer className="editor-actions"><button className="btn btn-soft" type="button" onClick={onClose} disabled={save.isPending}>Cancelar</button><button className="btn btn-primary" type="button" onClick={() => { setError(null); save.mutate() }} disabled={save.isPending}>{save.isPending ? 'Salvando…' : 'Salvar registro'}</button></footer></section></div>
}

function Metric({ icon, title, value, detail, tone }: { icon: ReactNode; title: string; value: string; detail: string; tone: string }) {
  return <article className={`evolution-stat stat-${tone}`}><span className="evo-stat-icon">{icon}</span><p>{title}</p><h2>{value}</h2><span className="evo-muted">{detail}</span></article>
}

function MeasurementSummary({ label, value, unit }: { label: string; value: number | null | undefined; unit: string }) {
  return <div><span>{label}</span><strong>{value == null ? '—' : toDisplay(value)} <small>{unit}</small></strong></div>
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="form-label">{label}{children}</label>
}

function EmptyState({ icon, title, detail, action, actionLabel }: { icon: ReactNode; title: string; detail: string; action: () => void; actionLabel: string }) {
  return <div className="evolution-empty"><span>{icon}</span><h3>{title}</h3><p>{detail}</p><button className="btn btn-soft" type="button" onClick={action}><Plus size={15}/>{actionLabel}</button></div>
}

function goalDetail(delta: number | null) {
  if (delta === null) return 'Defina uma meta no Perfil'
  if (delta === 0) return 'Meta alcançada'
  return delta > 0 ? `Faltam ${toDisplay(delta)} kg` : `Meta ultrapassada em ${toDisplay(Math.abs(delta))} kg`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`))
}

function formatSigned(value: number) {
  return `${value > 0 ? '+' : ''}${toDisplay(value)}`
}
