import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, Calculator, ClipboardList, Eye, PencilLine, Plus, Printer, ShieldAlert, Trash2, X } from 'lucide-react'
import { doc, getDoc } from 'firebase/firestore'
import { useMemo, useState, type ReactNode } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useAuth } from '../hooks/useAuth'
import { EvolutionTabs } from './Evolution'
import { calculatePhysicalAssessmentMetrics, validatePhysicalAssessmentInput, type PhysicalAssessmentInput } from '../lib/evolution'
import { localIsoDate } from '../lib/dates'
import { db } from '../lib/firebase'
import type { BodyFatMethod, PhysicalAssessment } from '../lib/types'
import { evolutionService } from '../services/evolution-service'

type AssessmentEditor = { mode: 'new' | 'edit'; initial?: PhysicalAssessment } | null
type AssessmentDraft = Record<string, string>

const methodLabels: Record<BodyFatMethod, string> = {
  manual: 'Percentual informado manualmente',
  bioimpedance: 'Bioimpedância',
  navy: 'US Navy (circunferências)',
  'jackson-pollock-3': 'Jackson-Pollock 3 dobras',
  'jackson-pollock-7': 'Jackson-Pollock 7 dobras',
  'durnin-womersley': 'Durnin-Womersley',
  faulkner: 'Faulkner',
  guedes: 'Guedes',
  other: 'Outro resultado informado',
}

const circumferenceFields: { key: keyof PhysicalAssessment; label: string }[] = [
  { key: 'neckCm', label: 'Pescoço (cm)' }, { key: 'chestCm', label: 'Peitoral (cm)' }, { key: 'waistCm', label: 'Cintura (cm)' }, { key: 'abdomenCm', label: 'Abdômen (cm)' }, { key: 'hipCm', label: 'Quadril (cm)' },
]
const skinfoldFields: { key: keyof PhysicalAssessment; label: string }[] = [
  { key: 'tricepsSkinfoldMm', label: 'Tríceps (mm)' }, { key: 'bicepsSkinfoldMm', label: 'Bíceps (mm)' }, { key: 'subscapularSkinfoldMm', label: 'Subescapular (mm)' }, { key: 'suprailiacSkinfoldMm', label: 'Supra-ilíaca (mm)' }, { key: 'abdominalSkinfoldMm', label: 'Abdominal (mm)' }, { key: 'chestSkinfoldMm', label: 'Peitoral (mm)' }, { key: 'midaxillarySkinfoldMm', label: 'Axilar média (mm)' }, { key: 'thighSkinfoldMm', label: 'Coxa (mm)' }, { key: 'calfSkinfoldMm', label: 'Panturrilha (mm)' },
]
const compositionFields: { key: keyof PhysicalAssessment; label: string; unit: string }[] = [
  { key: 'muscleMassKg', label: 'Massa muscular', unit: 'kg' }, { key: 'boneMassKg', label: 'Massa óssea', unit: 'kg' }, { key: 'bodyWaterPercent', label: 'Água corporal', unit: '%' }, { key: 'visceralFatLevel', label: 'Gordura visceral', unit: 'nível' }, { key: 'metabolicAge', label: 'Idade metabólica', unit: 'anos' }, { key: 'basalMetabolicRateKcal', label: 'Taxa metabólica basal', unit: 'kcal' },
]

function display(value: number | null | undefined, digits = 1) {
  return value == null ? '—' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: digits }).format(value)
}
function dateLabel(value: string) { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`)) }
function ageFromBirthDate(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const birth = new Date(`${value}T12:00:00`)
  const now = new Date()
  let years = now.getFullYear() - birth.getFullYear()
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) years -= 1
  return years >= 0 && years <= 120 ? years : null
}

function draftFrom(initial?: PhysicalAssessment, profileAge?: number | null): AssessmentDraft {
  const values: AssessmentDraft = {
    assessmentDate: initial?.assessmentDate ?? localIsoDate(), evaluatorName: initial?.evaluatorName ?? '', evaluatorRegistration: initial?.evaluatorRegistration ?? '', goals: initial?.goals ?? '', observations: initial?.observations ?? '', recommendations: initial?.recommendations ?? '',
    weightKg: initial?.weightKg == null ? '' : String(initial.weightKg), heightCm: initial?.heightCm == null ? '' : String(initial.heightCm), bodyFatMethod: initial?.bodyFatMethod ?? 'manual', biologicalSex: initial?.biologicalSex ?? '', ageYears: initial?.ageYears == null ? (profileAge == null ? '' : String(profileAge)) : String(initial.ageYears),
  }
  const numericKeys: (keyof PhysicalAssessment)[] = [...circumferenceFields.map(({ key }) => key), ...skinfoldFields.map(({ key }) => key), ...compositionFields.map(({ key }) => key), 'reportedBodyFatPercent', 'restingHeartRate', 'systolicBloodPressure', 'diastolicBloodPressure']
  numericKeys.forEach((key) => { values[key] = initial?.[key] == null ? '' : String(initial[key]) })
  return values
}

export function PhysicalAssessmentPage() {
  const { user } = useAuth()
  const userId = user?.uid
  const client = useQueryClient()
  const [editor, setEditor] = useState<AssessmentEditor>(null)
  const [viewing, setViewing] = useState<PhysicalAssessment | null>(null)
  const [deleting, setDeleting] = useState<PhysicalAssessment | null>(null)
  const assessments = useQuery({ queryKey: ['physical-assessments', userId], queryFn: () => evolutionService.listPhysicalAssessments(userId!), enabled: Boolean(userId) })
  const profile = useQuery({
    queryKey: ['profile', userId],
    enabled: Boolean(userId && db),
    queryFn: async (): Promise<{ birthDate?: string | null } | null> => {
      if (!userId || !db) return null
      const snapshot = await getDoc(doc(db, 'profiles', userId))
      return snapshot.exists() ? snapshot.data() as { birthDate?: string | null } : null
    },
  })
  const profileAge = ageFromBirthDate(profile.data?.birthDate)
  const latest = assessments.data?.[0]
  const previous = assessments.data?.[1]
  const remove = useMutation({ mutationFn: (id: string) => evolutionService.deletePhysicalAssessment(userId!, id), onSuccess: async () => { await invalidate(); setDeleting(null) } })
  async function invalidate() {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['physical-assessments', userId] }),
      client.invalidateQueries({ queryKey: ['weight-logs', userId] }),
      client.invalidateQueries({ queryKey: ['weight-latest', userId] }),
      client.invalidateQueries({ queryKey: ['evolution', userId] }),
    ])
  }

  return <section className="evolution-page assessment-page">
    <header className="evolution-header"><div><p className="eyebrow">Evolução</p><h1 className="page-title">Avaliação <span>física.</span></h1><p className="page-subtitle">Resultados estimativos organizados para acompanhar com um profissional quando necessário.</p></div><button className="btn btn-primary" type="button" onClick={() => setEditor({ mode: 'new' })}><Plus size={16}/> Nova avaliação</button></header>
    <EvolutionTabs />
    <section className="assessment-notice"><ShieldAlert size={19}/><p>Os cálculos apresentados são estimativas e não substituem avaliação médica, nutricional ou profissional presencial.</p></section>
    {latest ? <section className="assessment-summary"><article><span><ClipboardList size={18}/></span><p>Última avaliação</p><h2>{dateLabel(latest.assessmentDate)}</h2><small>{methodLabels[latest.bodyFatMethod]}</small></article><article><span><Activity size={18}/></span><p>IMC estimado</p><h2>{display(latest.bmi, 2)}</h2><small>Peso: {display(latest.weightKg)} kg · altura: {display(latest.heightCm)} cm</small></article><article><span><Calculator size={18}/></span><p>Gordura corporal</p><h2>{bodyFatLabel(latest)}</h2><small>{latest.calculatedBodyFatPercent != null ? 'Calculada pelo protocolo' : 'Resultado informado'}</small></article></section> : null}
    {latest && previous ? <section className="assessment-compare"><div><p className="eyebrow">Comparação</p><h2 className="section-heading">Entre as duas últimas avaliações</h2></div><div className="assessment-compare-grid"><Compare label="Peso" current={latest.weightKg} previous={previous.weightKg} unit="kg"/><Compare label="IMC" current={latest.bmi} previous={previous.bmi} unit=""/><Compare label="% de gordura" current={latest.calculatedBodyFatPercent ?? latest.reportedBodyFatPercent} previous={previous.calculatedBodyFatPercent ?? previous.reportedBodyFatPercent} unit="%"/><Compare label="Massa magra" current={latest.leanMassKg} previous={previous.leanMassKg} unit="kg"/></div></section> : null}
    <section className="assessment-photo-status"><div><Eye size={18}/><div><strong>Fotos de evolução</strong><p>O upload permanece oculto até que o Firebase Storage privado e suas regras sejam configurados e verificados neste projeto.</p></div></div></section>
    <section className="evolution-history assessment-history"><div className="section-title-row"><div><p className="eyebrow">Histórico</p><h2 className="section-heading">Avaliações registradas</h2></div><span>{assessments.data?.length ?? 0} no total</span></div>{assessments.isLoading ? <p className="section-loading">Carregando avaliações…</p> : assessments.data?.length ? <div className="assessment-history-list">{assessments.data.map((assessment) => <article key={assessment.id} className="assessment-history-row"><div><strong>{dateLabel(assessment.assessmentDate)}</strong><span>{assessment.evaluatorName || 'Sem avaliador informado'} · {methodLabels[assessment.bodyFatMethod]}</span><small>{display(assessment.weightKg)} kg · IMC {display(assessment.bmi, 2)} · gordura {bodyFatLabel(assessment)}</small></div><div className="assessment-history-actions"><button type="button" aria-label={`Ver avaliação de ${dateLabel(assessment.assessmentDate)}`} onClick={() => setViewing(assessment)}><Eye size={15}/></button><button type="button" aria-label={`Editar avaliação de ${dateLabel(assessment.assessmentDate)}`} onClick={() => setEditor({ mode: 'edit', initial: assessment })}><PencilLine size={15}/></button><button type="button" aria-label={`Excluir avaliação de ${dateLabel(assessment.assessmentDate)}`} className="is-danger" onClick={() => setDeleting(assessment)}><Trash2 size={15}/></button></div></article>)}</div> : <AssessmentEmpty onCreate={() => setEditor({ mode: 'new' })} />}</section>
    <AssessmentEditorDialog key={editor ? `${editor.mode}-${editor.initial?.id ?? 'new'}` : 'closed'} editor={editor} userId={userId} profileAge={profileAge} onClose={() => setEditor(null)} onSaved={async () => { await invalidate(); setEditor(null) }} />
    <AssessmentReport assessment={viewing} onClose={() => setViewing(null)} />
    <ConfirmDialog open={Boolean(deleting)} title="Excluir esta avaliação?" description="Somente a avaliação selecionada será removida. Um peso eventualmente vinculado ao histórico permanece preservado." confirmLabel="Excluir avaliação" danger isConfirming={remove.isPending} onCancel={() => setDeleting(null)} onConfirm={() => { if (deleting) remove.mutate(deleting.id) }} />
  </section>
}

function AssessmentEditorDialog({ editor, userId, profileAge, onClose, onSaved }: { editor: AssessmentEditor; userId?: string; profileAge: number | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [draft, setDraft] = useState<AssessmentDraft>(() => draftFrom(editor?.initial, profileAge))
  const [registerWeight, setRegisterWeight] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const method = (draft.bodyFatMethod || 'manual') as BodyFatMethod
  const metrics = useMemo(() => calculatePhysicalAssessmentMetrics(draft as unknown as Partial<PhysicalAssessmentInput>), [draft])
  const save = useMutation({
    mutationFn: async () => {
      if (!userId || !editor) throw new Error('Sua sessão não está disponível.')
      const validation = validatePhysicalAssessmentInput(draft as unknown as Partial<PhysicalAssessmentInput>)
      if (!validation.ok) throw new Error(validation.errors.map((item) => item.message).join(' '))
      if (editor.mode === 'edit' && editor.initial) await evolutionService.updatePhysicalAssessment(userId, editor.initial.id, validation.value, { registerWeight })
      else await evolutionService.createPhysicalAssessment(userId, validation.value, { registerWeight })
    },
    onSuccess: () => onSaved(),
    onError: (reason) => setError(reason instanceof Error ? reason.message : 'Não foi possível salvar a avaliação.'),
  })
  if (!editor) return null
  const update = (key: string, value: string) => setDraft((current) => ({ ...current, [key]: value }))
  return <div className="editor-backdrop" role="presentation" onMouseDown={onClose}><section className="assessment-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="assessment-editor-title" onMouseDown={(event) => event.stopPropagation()}><button className="editor-close" type="button" aria-label="Fechar" onClick={onClose} disabled={save.isPending}><X size={17}/></button><p className="eyebrow">Avaliação física</p><h2 id="assessment-editor-title">{editor.mode === 'edit' ? 'Editar avaliação' : 'Nova avaliação'}</h2><p className="editor-helper">Todos os resultados calculados são armazenados como estimativas informativas com o método utilizado.</p><fieldset className="assessment-fieldset"><legend>Identificação e dados básicos</legend><div className="assessment-editor-grid"><FormField label="Data da avaliação"><input className="field" type="date" max={localIsoDate()} value={draft.assessmentDate} onChange={(event) => update('assessmentDate', event.target.value)} /></FormField><FormField label="Nome do avaliador"><input className="field" value={draft.evaluatorName} onChange={(event) => update('evaluatorName', event.target.value)} placeholder="Opcional" /></FormField><FormField label="Registro profissional"><input className="field" value={draft.evaluatorRegistration} onChange={(event) => update('evaluatorRegistration', event.target.value)} placeholder="Opcional" /></FormField><FormField label="Objetivo da avaliação"><input className="field" value={draft.goals} onChange={(event) => update('goals', event.target.value)} placeholder="Opcional" /></FormField><FormField label="Peso (kg)"><input className="field" inputMode="decimal" value={draft.weightKg} onChange={(event) => update('weightKg', event.target.value)} placeholder="Obrigatório" /></FormField><FormField label="Altura (cm)"><input className="field" inputMode="decimal" value={draft.heightCm} onChange={(event) => update('heightCm', event.target.value)} placeholder="Obrigatório" /></FormField></div></fieldset><fieldset className="assessment-fieldset"><legend>Método de percentual de gordura</legend><div className="assessment-editor-grid"><FormField label="Método"><select className="field" value={method} onChange={(event) => update('bodyFatMethod', event.target.value)}>{Object.entries(methodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FormField>{methodNeedsSex(method) && <FormField label="Sexo biológico (exigido pelo protocolo)"><select className="field" value={draft.biologicalSex} onChange={(event) => update('biologicalSex', event.target.value)}><option value="">Selecione</option><option value="female">Feminino</option><option value="male">Masculino</option></select></FormField>}{methodNeedsAge(method) && <FormField label="Idade usada no protocolo"><input className="field" inputMode="numeric" readOnly={profileAge !== null} value={draft.ageYears} onChange={(event) => update('ageYears', event.target.value)} placeholder="Preencha a data de nascimento no Perfil" /></FormField>}{['manual', 'bioimpedance', 'other'].includes(method) && <FormField label="Percentual de gordura informado (%)"><input className="field" inputMode="decimal" value={draft.reportedBodyFatPercent} onChange={(event) => update('reportedBodyFatPercent', event.target.value)} placeholder="Obrigatório para este método" /></FormField>}</div><ProtocolHint method={method} /></fieldset><fieldset className="assessment-fieldset"><legend>Circunferências</legend><div className="assessment-editor-grid">{circumferenceFields.map(({ key, label }) => <FormField key={key} label={label}><input className="field" inputMode="decimal" value={draft[key]} onChange={(event) => update(key, event.target.value)} placeholder="Opcional" /></FormField>)}</div></fieldset><fieldset className="assessment-fieldset"><legend>Dobras cutâneas</legend><div className="assessment-editor-grid">{skinfoldFields.map(({ key, label }) => <FormField key={key} label={label}><input className="field" inputMode="decimal" value={draft[key]} onChange={(event) => update(key, event.target.value)} placeholder="Opcional" /></FormField>)}</div></fieldset><fieldset className="assessment-fieldset"><legend>Bioimpedância e informações adicionais</legend><div className="assessment-editor-grid">{compositionFields.map(({ key, label, unit }) => <FormField key={key} label={`${label} (${unit})`}><input className="field" inputMode="decimal" value={draft[key]} onChange={(event) => update(key, event.target.value)} placeholder="Opcional" /></FormField>)}<FormField label="Frequência cardíaca em repouso"><input className="field" inputMode="decimal" value={draft.restingHeartRate} onChange={(event) => update('restingHeartRate', event.target.value)} placeholder="bpm" /></FormField><FormField label="Pressão sistólica"><input className="field" inputMode="decimal" value={draft.systolicBloodPressure} onChange={(event) => update('systolicBloodPressure', event.target.value)} placeholder="mmHg" /></FormField><FormField label="Pressão diastólica"><input className="field" inputMode="decimal" value={draft.diastolicBloodPressure} onChange={(event) => update('diastolicBloodPressure', event.target.value)} placeholder="mmHg" /></FormField></div></fieldset><AssessmentMetrics metrics={metrics} /><label className="weight-checkbox"><input type="checkbox" checked={registerWeight} onChange={(event) => setRegisterWeight(event.target.checked)} /> Também registrar este peso no histórico</label><div className="assessment-textareas"><FormField label="Observações"><textarea className="field" rows={3} value={draft.observations} onChange={(event) => update('observations', event.target.value)} /></FormField><FormField label="Recomendações"><textarea className="field" rows={3} value={draft.recommendations} onChange={(event) => update('recommendations', event.target.value)} /></FormField></div>{error && <p className="form-error" role="alert">{error}</p>}<footer className="editor-actions"><button className="btn btn-soft" type="button" onClick={onClose} disabled={save.isPending}>Cancelar</button><button className="btn btn-primary" type="button" onClick={() => { setError(null); save.mutate() }} disabled={save.isPending}>{save.isPending ? 'Salvando…' : 'Salvar avaliação'}</button></footer></section></div>
}

function ProtocolHint({ method }: { method: BodyFatMethod }) {
  const text: Record<BodyFatMethod, string> = {
    manual: 'Informe o percentual apurado manualmente.', bioimpedance: 'Informe o percentual fornecido pelo equipamento.', other: 'Informe o percentual e registre o método nas observações.', navy: 'Exige altura, pescoço e cintura; para feminino, também quadril.', 'jackson-pollock-3': 'Exige idade, sexo biológico e as três dobras específicas do protocolo.', 'jackson-pollock-7': 'Exige idade, sexo biológico e as sete dobras cutâneas.', 'durnin-womersley': 'Exige idade, sexo biológico e dobras bicipital, tricipital, subescapular e supra-ilíaca.', faulkner: 'Exige dobras tricipital, subescapular, supra-ilíaca e abdominal.', guedes: 'Exige sexo biológico e as três dobras específicas do protocolo.',
  }
  return <p className="protocol-hint">{text[method]}</p>
}

function AssessmentMetrics({ metrics }: { metrics: ReturnType<typeof calculatePhysicalAssessmentMetrics> }) {
  return <section className="assessment-metrics-preview"><p className="eyebrow">Prévia informativa</p><div><Metric label="IMC" value={metrics.bmi} /><Metric label="Cintura/quadril" value={metrics.waistHipRatio} /><Metric label="Cintura/altura" value={metrics.waistHeightRatio} /><Metric label="% gordura" value={metrics.bodyFatPercent} suffix="%" /><Metric label="Massa de gordura" value={metrics.fatMassKg} suffix=" kg" /><Metric label="Massa magra" value={metrics.leanMassKg} suffix=" kg" /></div>{metrics.errors.length > 0 && <p className="protocol-hint">Complete os dados exigidos pelo método para calcular os resultados disponíveis.</p>}</section>
}

function Metric({ label, value, suffix = '' }: { label: string; value: number | null | undefined; suffix?: string }) { return <span><small>{label}</small><strong>{value == null ? '—' : `${display(value, 2)}${suffix}`}</strong></span> }
function bodyFatLabel(assessment: PhysicalAssessment) { const value = assessment.calculatedBodyFatPercent ?? assessment.reportedBodyFatPercent; return value == null ? '—' : `${display(value)}%` }
function FormField({ label, children }: { label: string; children: ReactNode }) { return <label className="form-label">{label}{children}</label> }
function methodNeedsAge(method: BodyFatMethod) { return ['jackson-pollock-3', 'jackson-pollock-7', 'durnin-womersley'].includes(method) }
function methodNeedsSex(method: BodyFatMethod) { return ['navy', 'jackson-pollock-3', 'jackson-pollock-7', 'durnin-womersley', 'guedes'].includes(method) }
function Compare({ label, current, previous, unit }: { label: string; current: number | null | undefined; previous: number | null | undefined; unit: string }) { const difference = current == null || previous == null ? null : current - previous; return <article><span>{label}</span><strong>{current == null ? '—' : `${display(current, 2)}${unit}`}</strong><p>{difference == null ? 'Sem comparação' : `Variação de ${difference > 0 ? '+' : ''}${display(difference, 2)}${unit}`}</p></article> }
function AssessmentEmpty({ onCreate }: { onCreate: () => void }) { return <div className="evolution-empty"><span><ClipboardList size={24}/></span><h3>Nenhuma avaliação registrada.</h3><p>Comece por peso, altura e um método de percentual de gordura.</p><button className="btn btn-soft" type="button" onClick={onCreate}><Plus size={15}/> Nova avaliação</button></div> }

function AssessmentReport({ assessment, onClose }: { assessment: PhysicalAssessment | null; onClose: () => void }) {
  if (!assessment) return null
  const bodyFat = assessment.calculatedBodyFatPercent ?? assessment.reportedBodyFatPercent
  return <div className="editor-backdrop" role="presentation" onMouseDown={onClose}><section className="assessment-report-dialog" role="dialog" aria-modal="true" aria-labelledby="assessment-report-title" onMouseDown={(event) => event.stopPropagation()}><button className="editor-close" type="button" aria-label="Fechar" onClick={onClose}><X size={17}/></button><p className="eyebrow">Relatório de avaliação</p><h2 id="assessment-report-title">{dateLabel(assessment.assessmentDate)}</h2><p className="editor-helper">{assessment.evaluatorName || 'Avaliador não informado'} · {methodLabels[assessment.bodyFatMethod]}</p><div className="assessment-report-grid"><Metric label="Peso" value={assessment.weightKg} suffix=" kg"/><Metric label="Altura" value={assessment.heightCm} suffix=" cm"/><Metric label="IMC" value={assessment.bmi}/><Metric label="% gordura" value={bodyFat} suffix="%"/><Metric label="Massa de gordura" value={assessment.fatMassKg} suffix=" kg"/><Metric label="Massa magra" value={assessment.leanMassKg} suffix=" kg"/><Metric label="Cintura/quadril" value={assessment.waistHipRatio}/><Metric label="Cintura/altura" value={assessment.waistHeightRatio}/></div>{assessment.goals && <ReportText label="Objetivos" value={assessment.goals}/>} {assessment.observations && <ReportText label="Observações" value={assessment.observations}/>} {assessment.recommendations && <ReportText label="Recomendações" value={assessment.recommendations}/>}<p className="assessment-report-disclaimer">Os cálculos são estimativas informativas e não substituem atendimento profissional presencial.</p><footer className="editor-actions"><button className="btn btn-soft" type="button" onClick={onClose}>Fechar</button><button className="btn btn-primary" type="button" onClick={() => window.print()}><Printer size={15}/> Imprimir relatório</button></footer></section></div>
}
function ReportText({ label, value }: { label: string; value: string }) { return <section className="assessment-report-text"><strong>{label}</strong><p>{value}</p></section> }
