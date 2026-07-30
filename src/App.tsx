import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { Layout } from './components/Layout'
import { Login, Onboarding } from './pages/Auth'
import { Dashboard } from './pages/Dashboard'
import { Diary } from './pages/Diary'
import { AddFood } from './pages/AddFood'
import { Evolution } from './pages/Evolution'
import { Profile } from './pages/Profile'
function Private() { const { user, loading, configured } = useAuth(); if (loading) return <div className="grid min-h-screen place-items-center text-brand">Carregando NutriPro…</div>; if (!configured) return <Login setup />; return user ? <Layout /> : <Navigate to="/entrar" replace /> }
export default function App() { return <AuthProvider><Routes><Route path="/entrar" element={<Login />} /><Route path="/onboarding" element={<Onboarding />} /><Route element={<Private />}><Route path="/" element={<Dashboard />} /><Route path="/diario" element={<Diary />} /><Route path="/adicionar" element={<AddFood />} /><Route path="/evolucao" element={<Evolution />} /><Route path="/perfil" element={<Profile />} /></Route><Route path="*" element={<Navigate to="/" replace />} /></Routes></AuthProvider> }
