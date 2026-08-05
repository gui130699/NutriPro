import { Navigate, Route, Routes } from 'react-router-dom'
import { lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { Layout } from './components/Layout'
import { PwaInstallControl } from './components/PwaInstallControl'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { ThemeProvider } from './components/theme/ThemeProvider'
import { auth, db } from './lib/firebase'
import { resolveOnboardingState, type OnboardingState } from './lib/onboarding-state'

const AddFood = lazy(() => import('./pages/AddFood').then((module) => ({ default: module.AddFood })))
const Login = lazy(() => import('./pages/Auth').then((module) => ({ default: module.Login })))
const Onboarding = lazy(() => import('./pages/Auth').then((module) => ({ default: module.Onboarding })))
const Dashboard = lazy(() => import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })))
const Diary = lazy(() => import('./pages/Diary').then((module) => ({ default: module.Diary })))
const Evolution = lazy(() => import('./pages/Evolution').then((module) => ({ default: module.Evolution })))
const BodyMeasurements = lazy(() => import('./pages/BodyMeasurements').then((module) => ({ default: module.BodyMeasurements })))
const PhysicalAssessmentPage = lazy(() => import('./pages/PhysicalAssessment').then((module) => ({ default: module.PhysicalAssessmentPage })))
const Lists = lazy(() => import('./pages/Lists').then((module) => ({ default: module.Lists })))
const Profile = lazy(() => import('./pages/Profile').then((module) => ({ default: module.Profile })))

function useOnboardingState(userId?: string): { state: OnboardingState; retry: () => void } {
  const [state, setState] = useState<OnboardingState>('loading')
  const [attempt, setAttempt] = useState(0)
  const retry = useCallback(() => setAttempt((current) => current + 1), [])

  useEffect(() => {
    let active = true
    if (!userId || !db) {
      setState('error')
      return () => { active = false }
    }
    const database = db

    setState('loading')
    void resolveOnboardingState(() => getDoc(doc(database, 'profiles', userId)))
      .then((nextState) => { if (active) setState(nextState) })

    return () => { active = false }
  }, [attempt, userId])

  return { state, retry }
}

function Private() {
  const { user, loading, configured } = useAuth()
  if (loading) return <div className="grid min-h-screen place-items-center text-brand">Carregando o NutriPro…</div>
  if (!configured) return <Login setup />
  return user ? <PrivateWithOnboarding userId={user.uid} /> : <Navigate to="/entrar" replace />
}

function EntryGate() {
  const { user, loading, configured } = useAuth()
  if (loading) return <div className="grid min-h-screen place-items-center text-brand">Carregando o NutriPro…</div>
  if (!configured) return <Login setup />
  return user ? <Navigate to="/" replace /> : <Login />
}

function OnboardingGate() {
  const { user, loading, configured } = useAuth()
  if (loading) return <div className="grid min-h-screen place-items-center text-brand">Carregando o NutriPro…</div>
  if (!configured || !user) return <Navigate to="/entrar" replace />
  return <OnboardingWithState userId={user.uid} />
}

function PrivateWithOnboarding({ userId }: { userId: string }) {
  return <OnboardingStateGate
    userId={userId}
    complete={<Layout />}
    incomplete={<Navigate to="/onboarding" replace />}
  />
}

function OnboardingWithState({ userId }: { userId: string }) {
  return <OnboardingStateGate
    userId={userId}
    complete={<Navigate to="/" replace />}
    incomplete={<Onboarding />}
  />
}

function OnboardingStateGate({ userId, complete, incomplete }: { userId: string; complete: ReactNode; incomplete: ReactNode }) {
  const { state, retry } = useOnboardingState(userId)
  if (state === 'loading') return <div className="grid min-h-screen place-items-center text-brand">Carregando seu {'espa\u00e7o'}…</div>
  if (state === 'error') return <OnboardingError retry={retry} />
  return state === 'complete' ? complete : incomplete
}

function OnboardingError({ retry }: { retry: () => void }) {
  return <main className="grid min-h-screen place-items-center bg-[#f3f7f2] p-5">
    <section className="w-full max-w-md rounded-[1.75rem] border border-[#dce9e0] bg-white p-7 text-center shadow-xl" role="alert" aria-live="assertive">
      <h1 className="text-2xl font-black text-[#143c35]">Não foi possível verificar seu perfil.</h1>
      <p className="mt-3 text-sm leading-6 text-[#63766f]">Confira sua conexão e tente novamente.</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button type="button" className="btn btn-primary" onClick={retry}>Tentar novamente</button>
        <button type="button" className="btn btn-soft" onClick={() => { if (auth) void signOut(auth) }}>Sair da conta</button>
      </div>
    </section>
  </main>
}

export default function App() {
  return <AuthProvider><ThemeProvider><PwaInstallControl /><Suspense fallback={<div className="app-loading">Carregando o NutriPro…</div>}><Routes>
    <Route path="/entrar" element={<EntryGate />} />
    <Route path="/onboarding" element={<OnboardingGate />} />
    <Route element={<Private />}>
      <Route path="/" element={<Dashboard />} />
      <Route path="/diario" element={<Diary />} />
      <Route path="/listas" element={<Lists />} />
      <Route path="/adicionar" element={<AddFood />} />
      <Route path="/evolucao" element={<Evolution />} />
      <Route path="/evolucao/medidas" element={<BodyMeasurements />} />
      <Route path="/evolucao/avaliacao-fisica" element={<PhysicalAssessmentPage />} />
      <Route path="/perfil" element={<Profile />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></Suspense></ThemeProvider></AuthProvider>
}
