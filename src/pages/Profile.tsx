import { ChevronRight, CircleHelp, Droplets, LogOut, Moon, ShieldCheck, SlidersHorizontal, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { useAuth } from '../hooks/useAuth'

export function Profile() {
  const nav = useNavigate()
  const { user } = useAuth()
  return <section className="profile-page"><header className="profile-page-header"><div><p className="eyebrow">Sua conta</p><h1 className="page-title">Tudo sobre <span>você.</span></h1><p className="page-subtitle">Ajuste suas preferências e mantenha o NutriPro do seu jeito.</p></div></header>
    <section className="profile-identity"><div className="large-profile-avatar">{user?.email?.slice(0, 2).toUpperCase() ?? 'NP'}</div><div><p>Conta NutriPro</p><h2>{user?.email ?? 'Seu espaço pessoal'}</h2><span><ShieldCheck size={14}/> Conta protegida</span></div><button className="small-outline-btn">Editar perfil <ChevronRight size={13}/></button></section>
    <div className="profile-grid"><div className="profile-settings"><SettingSection icon={SlidersHorizontal} tone="setting-green" title="Metas e medidas" description="Suas referências para acompanhar a rotina."><SettingRow label="Metas nutricionais" detail="Calorias, macros e fibras"/><SettingRow label="Objetivo atual" detail="Personalize seu foco"/></SettingSection><SettingSection icon={Droplets} tone="setting-blue" title="Preferências do diário" description="Deixe seus registros mais práticos."><SettingRow label="Meta de hidratação" detail="2.500 ml por dia"/><SettingRow label="Unidades e porções" detail="Gramas, ml e medidas caseiras"/></SettingSection><SettingSection icon={Moon} tone="setting-lilac" title="Experiência" description="Aparência e notificações."><SettingRow label="Tema da interface" detail="Claro"/><SettingRow label="Lembretes" detail="Desativados"/></SettingSection></div><aside className="profile-side"><article className="profile-support"><span><CircleHelp size={20}/></span><h2>Precisa de ajuda?</h2><p>Encontre respostas e dicas para aproveitar melhor o seu diário.</p><button>Central de ajuda <ChevronRight size={14}/></button></article><article className="profile-privacy"><div><ShieldCheck size={18}/><span>Privacidade em primeiro lugar</span></div><p>Somente você pode acessar seus dados alimentares e seus registros.</p></article></aside></div>
    <footer className="profile-footer"><div><p>Gerenciar conta</p><small>Você pode sair quando quiser.</small></div><button onClick={async () => { if (auth) await signOut(auth); nav('/entrar') }} className="signout-button"><LogOut size={16}/> Sair da conta</button></footer>
  </section>
}

function SettingSection({ icon: Icon, tone, title, description, children }: { icon: LucideIcon; tone: string; title: string; description: string; children: ReactNode }) { return <article className="setting-section"><div className="setting-heading"><span className={`setting-icon ${tone}`}><Icon size={17}/></span><div><h2>{title}</h2><p>{description}</p></div></div><div className="setting-rows">{children}</div></article> }
function SettingRow({ label, detail }: { label: string; detail: string }) { return <button className="setting-row"><span><strong>{label}</strong><small>{detail}</small></span><ChevronRight size={16}/></button> }
