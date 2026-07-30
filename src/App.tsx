import { Navigate, Route, Routes } from 'react-router-dom'
import { lazy, Suspense, useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { Layout } from './components/Layout'
import { PwaInstallControl } from './components/PwaInstallControl'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { ThemeProvider } from './components/theme/ThemeProvider'
import { db } from './lib/firebase'

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

type OnboardingState = 'loading' | 'complete' | 'incomplete'

function useOnboardingState(userId?: string): OnboardingState {
  const [state, setState] = useState<OnboardingState>('loading')

  useEffect(() => {
    let active = true
    if (!userId || !db) {
      setState('incomplete')
      return () => { active = false }
    }

    setState('loading')
    void getDoc(doc(db, 'profiles', userId))
      .then((snapshot) => {
        if (active) setState(snapshot.data()?.onboardingCompleted === true ? 'complete' : 'incomplete')
      })
      .catch(() => {
        if (active) setState('incomplete')
      })

    return () => { active = false }
  }, [userId])

  return state
}

function Private() {
  const { user, loading, configured } = useAuth()
  if (loading) return <div className="grid min-h-screen place-items-center text-brand">Carregando o NutriPro…</div>
  if (!configured) return <Login setup />
  return user ? <PrivateWithOnboarding userId={user.uid} /> : <Navigate to="/entrar" replace />
}

function PrivateWithOnboarding({ userId }: { userId: string }) {
  const onboarding = useOnboardingState(userId)
  if (onboarding === 'loading') return <div className="grid min-h-screen place-items-center text-brand">Carregando seu {'espa\u00e7o'}…</div>
  return onboarding === 'complete' ? <Layout /> : <Navigate to="/onboarding" replace />
}

export default function App() {
  return <AuthProvider><ThemeProvider><PwaInstallControl /><Suspense fallback={<div className="app-loading">Carregando o NutriPro…</div>}><Routes>
    <Route path="/entrar" element={<Login />} />
    <Route path="/onboarding" element={<Onboarding />} />
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
