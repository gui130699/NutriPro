import { Activity, BookOpen, ChevronRight, Droplets, Home, ListChecks, UserRound } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

const links = [
  { to: '/', label: 'Visão geral', icon: Home },
  { to: '/diario', label: 'Meu diário', icon: BookOpen },
  { to: '/listas', label: 'Listas', icon: ListChecks },
  { to: '/evolucao', label: 'Evolução', icon: Activity },
  { to: '/perfil', label: 'Perfil', icon: UserRound },
]

export function Layout() {
  const location = useLocation()
  const pageName = links.find((link) => link.to === location.pathname)?.label
    ?? (location.pathname === '/adicionar' ? 'Novo alimento' : 'NutriPro')
  return <div className="app-shell">
    <aside className="desktop-sidebar">
      <NavLink to="/" className="brand-lockup"><span className="brand-mark"><Droplets size={22} strokeWidth={2.8} /></span><span>nutri<span>pro</span></span></NavLink>
      <p className="sidebar-label">Seu espaço</p>
      <nav className="sidebar-nav">{links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `side-link ${isActive ? 'side-link-active' : ''}`}><Icon size={19} strokeWidth={2.1}/><span>{label}</span>{to === '/' && <ChevronRight size={16} className="side-arrow" />}</NavLink>)}</nav>
      <div className="sidebar-goal"><div className="sidebar-goal-icon"><Activity size={16}/></div><p>Uma escolha de cada vez.</p><strong>Seu bem-estar é o foco.</strong></div>
      <NavLink to="/perfil" className="profile-chip"><span className="profile-avatar">NP</span><span><strong>Minha conta</strong><small>Configurações</small></span><ChevronRight size={16}/></NavLink>
    </aside>
    <main className="main-stage">
      <div className="mobile-topbar"><NavLink to="/" className="brand-lockup"><span className="brand-mark"><Droplets size={19}/></span><span>nutri<span>pro</span></span></NavLink><span className="page-caption">{pageName}</span></div>
      <div className="page-container"><Outlet /></div>
    </main>
    <nav className="mobile-nav">{links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `mobile-link ${isActive ? 'mobile-link-active' : ''}`}>{({ isActive }) => <><span className="mobile-icon"><Icon size={19} strokeWidth={isActive ? 2.7 : 2}/></span><span>{label}</span></>}</NavLink>)}</nav>
  </div>
}
