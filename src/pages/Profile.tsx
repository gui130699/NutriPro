import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, CircleHelp, LogOut, Save, ShieldCheck, SlidersHorizontal, UserRound } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { ThemeSelector } from '../components/theme/ThemeSelector'
import { auth, db } from '../lib/firebase'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { nutritionService } from '../services/nutrition-service'

type ProfileData = {
  name?: string
  heightCm?: number
  goal?: string
}

type ProfileForm = {
  name: string
  heightCm: string
  goal: string
  calories: string
  protein: string
  carbs: string
  fat: string
  fiber: string
  waterMl: string
}

const emptyForm: ProfileForm = {
  name: '', heightCm: '', goal: 'Manutenção', calories: '2000', protein: '120', carbs: '250', fat: '65', fiber: '30', waterMl: '2500',
}

const positiveNumber = (value: string, fallback: number) => {
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function Profile() {
  const navigate = useNavigate()
  const client = useQueryClient()
  const { user } = useAuth()
  const userId = user?.uid
  const { theme, setTheme, isSyncing, syncError } = useTheme(userId)
  const [form, setForm] = useState<ProfileForm>(emptyForm)
  const [notice, setNotice] = useState<string | null>(null)

  const profile = useQuery({
    queryKey: ['profile', userId],
    enabled: Boolean(userId && db),
    queryFn: async (): Promise<ProfileData | null> => {
      if (!db || !userId) return null
      const snapshot = await getDoc(doc(db, 'profiles', userId))
      return snapshot.exists() ? snapshot.data() as ProfileData : null
    },
  })
  const goals = useQuery({ queryKey: ['goals', userId], queryFn: () => nutritionService.goals(userId!), enabled: Boolean(userId) })

  useEffect(() => {
    const profileData = profile.data
    const goalData = goals.data
    setForm({
      name: profileData?.name ?? '',
      heightCm: profileData?.heightCm ? String(profileData.heightCm) : '',
      goal: profileData?.goal ?? 'Manutenção',
      calories: String(goalData?.calories ?? 2000),
      protein: String(goalData?.protein ?? 120),
      carbs: String(goalData?.carbs ?? 250),
      fat: String(goalData?.fat ?? 65),
      fiber: String(goalData?.fiber ?? 30),
      waterMl: String(goalData?.waterMl ?? 2500),
    })
  }, [goals.data, profile.data])

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!db || !userId) throw new Error('Sua sessão não está disponível.')
      const heightCm = form.heightCm ? positiveNumber(form.heightCm, 0) : null
      await Promise.all([
        setDoc(doc(db, 'profiles', userId), {
          userId,
          name: form.name.trim(),
          heightCm,
          goal: form.goal,
          updatedAt: serverTimestamp(),
        }, { merge: true }),
        setDoc(doc(db, 'goals', userId), {
          userId,
          calories: positiveNumber(form.calories, 2000),
          protein: positiveNumber(form.protein, 120),
          carbs: positiveNumber(form.carbs, 250),
          fat: positiveNumber(form.fat, 65),
          fiber: positiveNumber(form.fiber, 30),
          waterMl: positiveNumber(form.waterMl, 2500),
          updatedAt: serverTimestamp(),
        }, { merge: true }),
      ])
    },
    onSuccess: () => {
      setNotice('Preferências salvas com sucesso.')
      void client.invalidateQueries({ queryKey: ['profile', userId] })
      void client.invalidateQueries({ queryKey: ['goals', userId] })
    },
  })

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setNotice(null)
    saveProfile.mutate()
  }
  const update = (field: keyof ProfileForm, value: string) => setForm((current) => ({ ...current, [field]: value }))
  const initials = (form.name || user?.email || 'NP').slice(0, 2).toUpperCase()

  return <section className="profile-page">
    <header className="profile-page-header"><div><p className="eyebrow">Sua conta</p><h1 className="page-title">Tudo sobre <span>você.</span></h1><p className="page-subtitle">Ajuste suas preferências e mantenha o NutriPro do seu jeito.</p></div></header>
    <section className="profile-identity"><div className="large-profile-avatar">{initials}</div><div><p>Conta NutriPro</p><h2>{form.name || user?.email || 'Seu espaço pessoal'}</h2><span><ShieldCheck size={14} /> Conta protegida</span></div><button className="small-outline-btn" type="button" onClick={() => document.getElementById('profile-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Editar perfil <ChevronRight size={13} /></button></section>

    <div className="profile-grid">
      <div className="profile-settings">
        <form id="profile-form" className="profile-edit-card" onSubmit={submit} noValidate>
          <div className="setting-heading"><span className="setting-icon setting-green"><UserRound size={17} /></span><div><h2>Perfil, metas e medidas</h2><p>Essas informações podem ser atualizadas quando você quiser.</p></div></div>
          <div className="profile-form-grid">
            <label className="form-label form-label-wide">Como podemos chamar você?<input className="field" value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Seu nome" /></label>
            <label className="form-label">Objetivo principal<select className="field" value={form.goal} onChange={(event) => update('goal', event.target.value)}><option>Emagrecimento</option><option>Manutenção</option><option>Ganho de massa</option><option>Saúde e bem-estar</option></select></label>
            <label className="form-label">Altura (cm)<input className="field" type="number" min="1" step="0.1" inputMode="decimal" value={form.heightCm} onChange={(event) => update('heightCm', event.target.value)} placeholder="Ex.: 168" /></label>
          </div>
          <div className="profile-form-divider" />
          <h3 className="profile-form-subtitle">Metas diárias</h3>
          <div className="profile-form-grid profile-goal-grid">
            <NumberField label="Calorias (kcal)" field="calories" value={form.calories} onChange={update} />
            <NumberField label="Proteínas (g)" field="protein" value={form.protein} onChange={update} />
            <NumberField label="Carboidratos (g)" field="carbs" value={form.carbs} onChange={update} />
            <NumberField label="Gorduras (g)" field="fat" value={form.fat} onChange={update} />
            <NumberField label="Fibras (g)" field="fiber" value={form.fiber} onChange={update} />
            <NumberField label="Hidratação (ml)" field="waterMl" value={form.waterMl} onChange={update} />
          </div>
          <footer className="profile-form-actions"><div>{notice && <p className="save-status save-success">{notice}</p>}{saveProfile.error && <p className="save-status save-error">Não foi possível salvar agora. Revise os campos e tente novamente.</p>}</div><button className="btn btn-primary" type="submit" disabled={saveProfile.isPending}><Save size={16} />{saveProfile.isPending ? 'Salvando…' : 'Salvar preferências'}</button></footer>
        </form>

        <section className="setting-section"><div className="setting-heading"><span className="setting-icon setting-lilac"><SlidersHorizontal size={17} /></span><div><h2>Aparência</h2><p>Escolha como o NutriPro deve ser exibido.</p></div></div><div className="theme-setting-content"><ThemeSelector value={theme} onChange={(nextTheme) => { void setTheme(nextTheme) }} disabled={isSyncing} />{syncError && <p className="theme-sync-error">A preferência foi aplicada neste dispositivo, mas ainda não foi sincronizada.</p>}</div></section>
      </div>
      <aside className="profile-side"><article className="profile-support"><span><CircleHelp size={20} /></span><h2>Precisa de ajuda?</h2><p>Use as listas para organizar alimentos e as refeições para personalizar o diário.</p><button type="button" onClick={() => navigate('/listas')}>Abrir minhas listas <ChevronRight size={14} /></button></article><article className="profile-privacy"><div><ShieldCheck size={18} /><span>Privacidade em primeiro lugar</span></div><p>Somente você pode acessar seus dados alimentares e seus registros.</p></article></aside>
    </div>
    <footer className="profile-footer"><div><p>Gerenciar conta</p><small>Você pode sair quando quiser.</small></div><button type="button" onClick={async () => { if (auth) await signOut(auth); navigate('/entrar') }} className="signout-button"><LogOut size={16} /> Sair da conta</button></footer>
  </section>
}

function NumberField({ label, field, value, onChange }: { label: string; field: keyof ProfileForm; value: string; onChange: (field: keyof ProfileForm, value: string) => void }) {
  return <label className="form-label">{label}<input className="field" type="number" min="0.01" step="0.1" inputMode="decimal" value={value} onChange={(event) => onChange(field, event.target.value)} /></label>
}
