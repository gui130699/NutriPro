import { Navigate, Route, Routes } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { Layout } from './components/Layout'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { useTheme } from './hooks/useTheme'

const AddFood = lazy(() => import('./pages/AddFood').then((module) => ({ default: module.AddFood })))
const Login = lazy(() => import('./pages/Auth').then((module) => ({ default: module.Login })))
const Onboarding = lazy(() => import('./pages/Auth').then((module) => ({ default: module.Onboarding })))
const Dashboard = lazy(() => import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })))
const Diary = lazy(() => import('./pages/Diary').then((module) => ({ default: module.Diary })))
const Evolution = lazy(() => import('./pages/Evolution').then((module) => ({ default: module.Evolution })))
const Lists = lazy(() => import('./pages/Lists').then((module) => ({ default: module.Lists })))
const Profile = lazy(() => import('./pages/Profile').then((module) => ({ default: module.Profile })))

function ThemeManager() {
  const { user } = useAuth()
  useTheme(user?.uid)
  return null
}

function Private() {
  const { user, loading, configured } = useAuth()
  if (loading) return <div className="grid min-h-screen place-items-center text-brand">Carregando o NutriPro…</div>
  if (!configured) return <Login setup />
  return user ? <Layout /> : <Navigate to="/entrar" replace />
}

export default function App() {
  return <AuthProvider><ThemeManager /><Suspense fallback={<div className="app-loading">Carregando o NutriPro…</div>}><Routes>
    <Route path="/entrar" element={<Login />} />
    <Route path="/onboarding" element={<Onboarding />} />
    <Route element={<Private />}>
      <Route path="/" element={<Dashboard />} />
      <Route path="/diario" element={<Diary />} />
      <Route path="/listas" element={<Lists />} />
      <Route path="/adicionar" element={<AddFood />} />
      <Route path="/evolucao" element={<Evolution />} />
      <Route path="/perfil" element={<Profile />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></Suspense></AuthProvider>
}
