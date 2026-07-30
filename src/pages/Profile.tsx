import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, CircleHelp, LogOut, Save, Scale, ShieldCheck, SlidersHorizontal, Target, UserRound } from 'lucide-react'
import { signOut } from 'firebase/auth'
import { doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { ThemeSelector } from '../components/theme/ThemeSelector'
import { useThemeContext } from '../components/theme/ThemeProvider'
import { useAuth } from '../hooks/useAuth'
import { auth, db } from '../lib/firebase'
import type { UserGoal } from '../lib/types'
import { evolutionService } from '../services/evolution-service'
import { nutritionService } from '../services/nutrition-service'

const goals: UserGoal[] = ['Emagrecimento', 'Manutenção', 'Ganho de peso', 'Saúde e bem-estar']

const decimalPattern = /^\d+(?:[.,]\d+)?$/

function validDecimal(value: string, min: number, max: number, required = true) {
  const input = value.trim()
  if (!input) return !required
  if (!decimalPattern.test(input)) return false
  const parsed = Number(input.replace(',', '.'))
  return Number.isFinite(parsed) && parsed >= min && parsed <= max
}

const requiredDecimal = (label: string, min: number, max: number) => z.string().trim()
  .min(1, `Informe ${label}.`)
  .refine((value) => validDecimal(value, min, max), `Informe ${label} entre ${min.toLocaleString('pt-BR')} e ${max.toLocaleString('pt-BR')}.`)

const optionalDecimal = (label: string, min: number, max: number) => z.string().trim()
  .refine((value) => validDecimal(value, min, max, false), `Informe ${label} entre ${min.toLocaleString('pt-BR')} e ${max.toLocaleString('pt-BR')}.`)

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Informe pelo menos 2 caracteres para o seu nome.').max(80, 'Use no máximo 80 caracteres.'),
  heightCm: requiredDecimal('uma altura válida', 80, 260),
  goal: z.enum(['Emagrecimento', 'Manutenção', 'Ganho de peso', 'Saúde e bem-estar']),
  currentWeightKg: optionalDecimal('um peso atual válido', 25, 500),
  weightGoalKg: optionalDecimal('uma meta de peso válida', 25, 500),
  calories: requiredDecimal('uma meta de calorias válida', 500, 10000),
  protein: requiredDecimal('uma meta de proteínas válida', 0, 1000),
  carbs: requiredDecimal('uma meta de carboidratos válida', 0, 2000),
  fat: requiredDecimal('uma meta de gorduras válida', 0, 1000),
  fiber: requiredDecimal('uma meta de fibras válida', 0, 250),
  waterMl: requiredDecimal('uma meta de hidratação válida', 0, 15000),
})

type ProfileForm = z.infer<typeof profileSchema>

type ProfileData = {
  name?: string | null
  heightCm?: number | null
  goal?: UserGoal | null
}

const emptyForm: ProfileForm = {
  name: '',
  heightCm: '',
  goal: 'Manutenção',
  currentWeightKg: '',
  weightGoalKg: '',
  calories: '',
  protein: '',
  carbs: '',
  fat: '',
  fiber: '',
  waterMl: '',
}

const decimalValue = (value: string) => value.trim() ? Number(value.replace(',', '.')) : null
const displayNumber = (value: number | null | undefined) => value == null ? '' : String(value).replace('.', ',')

export function Profile() {
  const navigate = useNavigate()
  const client = useQueryClient()
  const { user } = useAuth()
  const { theme, setTheme, isSyncing, syncError } = useThemeContext()
  const userId = user?.uid
  const [notice, setNotice] = useState<string | null>(null)
  const loaded = useRef(false)
  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: emptyForm,
  })

  const profile = useQuery({
    queryKey: ['profile', userId],
    enabled: Boolean(userId && db),
    queryFn: async (): Promise<ProfileData | null> => {
      if (!db || !userId) return null
      const snapshot = await getDoc(doc(db, 'profiles', userId))
      return snapshot.exists() ? snapshot.data() as ProfileData : null
    },
  })
  const nutritionGoals = useQuery({ queryKey: ['goals', userId], queryFn: () => nutritionService.goals(userId!), enabled: Boolean(userId) })
  const latestWeight = useQuery({ queryKey: ['weight-latest', userId], queryFn: () => evolutionService.latestWeight(userId!), enabled: Boolean(userId) })

  useEffect(() => {
    if (loaded.current || profile.isLoading || nutritionGoals.isLoading || latestWeight.isLoading) return
    const savedProfile = profile.data
    const savedGoals = nutritionGoals.data
    reset({
      name: savedProfile?.name ?? '',
      heightCm: displayNumber(savedProfile?.heightCm),
      goal: savedProfile?.goal && goals.includes(savedProfile.goal) ? savedProfile.goal : 'Manutenção',
      currentWeightKg: displayNumber(latestWeight.data?.weightKg),
      weightGoalKg: displayNumber(savedGoals?.weightGoalKg),
      calories: displayNumber(savedGoals?.calories),
      protein: displayNumber(savedGoals?.protein),
      carbs: displayNumber(savedGoals?.carbs),
      fat: displayNumber(savedGoals?.fat),
      fiber: displayNumber(savedGoals?.fiber),
      waterMl: displayNumber(savedGoals?.waterMl),
    })
    loaded.current = true
  }, [latestWeight.data?.weightKg, latestWeight.isLoading, nutritionGoals.data, nutritionGoals.isLoading, profile.data, profile.isLoading, reset])

  const saveProfile = useMutation({
    mutationFn: async (values: ProfileForm) => {
      if (!db || !userId) throw new Error('Sua sessão não está disponível.')
      const [profileSnapshot, goalsSnapshot] = await Promise.all([
        getDoc(doc(db, 'profiles', userId)),
        getDoc(doc(db, 'goals', userId)),
      ])
      const batch = writeBatch(db)
      const profileRef = doc(db, 'profiles', userId)
      const goalsRef = doc(db, 'goals', userId)
      const now = serverTimestamp()
      batch.set(profileRef, {
        userId,
        name: values.name.trim(),
        displayName: values.name.trim(),
        heightCm: decimalValue(values.heightCm),
        goal: values.goal,
        onboardingCompleted: true,
        updatedAt: now,
        ...(!profileSnapshot.exists() || profileSnapshot.data().createdAt === undefined ? { createdAt: now } : {}),
      }, { merge: true })
      batch.set(goalsRef, {
        userId,
        calories: decimalValue(values.calories),
        protein: decimalValue(values.protein),
        carbs: decimalValue(values.carbs),
        fat: decimalValue(values.fat),
        fiber: decimalValue(values.fiber),
        waterMl: decimalValue(values.waterMl),
        weightGoalKg: decimalValue(values.weightGoalKg),
        updatedAt: now,
        ...(!goalsSnapshot.exists() || goalsSnapshot.data().createdAt === undefined ? { createdAt: now } : {}),
      }, { merge: true })
      await batch.commit()

      const currentWeightKg = decimalValue(values.currentWeightKg)
      const recordedWeight = latestWeight.data?.weightKg
      if (currentWeightKg !== null && currentWeightKg !== recordedWeight) {
        await evolutionService.createWeight(userId, {
          date: undefined,
          weightKg: currentWeightKg,
          source: 'profile',
          notes: null,
          time: null,
          fasted: null,
        })
      }
    },
    onSuccess: async () => {
      setNotice('Perfil e metas salvos com sucesso.')
      await Promise.all([
        client.invalidateQueries({ queryKey: ['profile', userId] }),
        client.invalidateQueries({ queryKey: ['goals', userId] }),
        client.invalidateQueries({ queryKey: ['weight-latest', userId] }),
        client.invalidateQueries({ queryKey: ['weight-logs', userId] }),
        client.invalidateQueries({ queryKey: ['evolution', userId] }),
      ])
    },
  })

  const initials = (profile.data?.name || user?.email || 'NP').slice(0, 2).toUpperCase()
  const status = saveProfile.error instanceof Error ? saveProfile.error.message : null

  return <section className="profile-page">
    <header className="profile-page-header"><div><p className="eyebrow">Sua conta</p><h1 className="page-title">Tudo sobre <span>você.</span></h1><p className="page-subtitle">Ajuste suas preferências, metas e histórico sem perder o que já foi registrado.</p></div></header>
    <section className="profile-identity"><div className="large-profile-avatar">{initials}</div><div><p>Conta NutriPro</p><h2>{profile.data?.name || user?.email || 'Seu espaço pessoal'}</h2><span><ShieldCheck size={14} /> Conta protegida</span></div><button className="small-outline-btn" type="button" onClick={() => document.getElementById('profile-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Editar perfil <ChevronRight size={13} /></button></section>

    <div className="profile-grid">
      <div className="profile-settings">
        <form id="profile-form" className="profile-edit-card" onSubmit={handleSubmit((values) => { setNotice(null); saveProfile.mutate(values) })} noValidate>
          <div className="setting-heading"><span className="setting-icon setting-green"><UserRound size={17} /></span><div><h2>Perfil, metas e medidas</h2><p>Valores inválidos são exibidos para correção; nada é substituído automaticamente.</p></div></div>
          <div className="profile-form-grid">
            <Field label="Como podemos chamar você?" error={errors.name?.message} wide><input className="field" {...register('name')} placeholder="Seu nome" /></Field>
            <Field label="Objetivo principal" error={errors.goal?.message}><select className="field" {...register('goal')}>{goals.map((goal) => <option key={goal}>{goal}</option>)}</select></Field>
            <Field label="Altura (cm)" error={errors.heightCm?.message}><input className="field" inputMode="decimal" {...register('heightCm')} placeholder="Ex.: 168" /></Field>
          </div>
          <div className="profile-form-divider" />
          <h3 className="profile-form-subtitle"><Scale size={14} /> Peso</h3>
          <div className="profile-form-grid">
            <Field label="Peso atual (kg)" error={errors.currentWeightKg?.message}><input className="field" inputMode="decimal" {...register('currentWeightKg')} placeholder="Ex.: 72,5" aria-describedby="current-weight-help" /></Field>
            <Field label="Meta de peso (kg)" error={errors.weightGoalKg?.message}><input className="field" inputMode="decimal" {...register('weightGoalKg')} placeholder="Opcional" /></Field>
          </div>
          <p id="current-weight-help" className="profile-field-help">Ao mudar o peso atual, o NutriPro cria um novo registro histórico com a data local de hoje.</p>
          <div className="profile-form-divider" />
          <h3 className="profile-form-subtitle"><Target size={14} /> Metas diárias</h3>
          <div className="profile-form-grid profile-goal-grid">
            <Field label="Calorias (kcal)" error={errors.calories?.message}><input className="field" inputMode="decimal" {...register('calories')} /></Field>
            <Field label="Proteínas (g)" error={errors.protein?.message}><input className="field" inputMode="decimal" {...register('protein')} /></Field>
            <Field label="Carboidratos (g)" error={errors.carbs?.message}><input className="field" inputMode="decimal" {...register('carbs')} /></Field>
            <Field label="Gorduras (g)" error={errors.fat?.message}><input className="field" inputMode="decimal" {...register('fat')} /></Field>
            <Field label="Fibras (g)" error={errors.fiber?.message}><input className="field" inputMode="decimal" {...register('fiber')} /></Field>
            <Field label="Hidratação (ml)" error={errors.waterMl?.message}><input className="field" inputMode="decimal" {...register('waterMl')} /></Field>
          </div>
          <footer className="profile-form-actions"><div>{notice && <p className="save-status save-success" role="status">{notice}</p>}{status && <p className="save-status save-error" role="alert">{status}</p>}</div><button className="btn btn-primary" type="submit" disabled={isSubmitting || saveProfile.isPending || (!isDirty && loaded.current)}><Save size={16} />{isSubmitting || saveProfile.isPending ? 'Salvando…' : 'Salvar preferências'}</button></footer>
        </form>

        <section className="setting-section"><div className="setting-heading"><span className="setting-icon setting-lilac"><SlidersHorizontal size={17} /></span><div><h2>Aparência</h2><p>Essa escolha é aplicada na hora e sincronizada uma única vez por conta.</p></div></div><div className="theme-setting-content"><ThemeSelector value={theme} onChange={(nextTheme) => { void setTheme(nextTheme) }} disabled={isSyncing} />{syncError && <p className="theme-sync-error">A preferência foi aplicada neste dispositivo, mas ainda não foi sincronizada.</p>}</div></section>
      </div>
      <aside className="profile-side"><article className="profile-support"><span><CircleHelp size={20} /></span><h2>Precisa de ajuda?</h2><p>Use as listas para organizar alimentos e acompanhe seu progresso pela central de evolução.</p><button type="button" onClick={() => navigate('/evolucao')}>Abrir evolução <ChevronRight size={14} /></button></article><article className="profile-privacy"><div><ShieldCheck size={18} /><span>Privacidade em primeiro lugar</span></div><p>Somente você pode acessar seus dados alimentares e registros corporais.</p></article></aside>
    </div>
    <footer className="profile-footer"><div><p>Gerenciar conta</p><small>Você pode sair quando quiser.</small></div><button type="button" onClick={async () => { if (auth) await signOut(auth); navigate('/entrar') }} className="signout-button"><LogOut size={16} /> Sair da conta</button></footer>
  </section>
}

function Field({ label, error, children, wide = false }: { label: string; error?: string; children: ReactNode; wide?: boolean }) {
  return <label className={`form-label ${wide ? 'form-label-wide' : ''}`}>{label}{children}{error && <span className="form-error" role="alert">{error}</span>}</label>
}
