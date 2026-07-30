import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CalendarDays, Droplets, Flame, Leaf, Plus, Sparkles, Utensils, Wheat } from 'lucide-react'
import { Link } from 'react-router-dom'
import { MetricCard } from '../components/MetricCard'
import { OfflineStatus } from '../components/OfflineStatus'
import { useAuth } from '../hooks/useAuth'
import { br, sumNutrients } from '../lib/nutrition'
import { nutritionService } from '../services/nutrition-service'

const fallbackGoal = { calories: 2000, protein: 120, carbs: 250, fat: 65, fiber: 30, water_ml: 2500 }
const getGreeting = () => { const hour = new Date().getHours(); return hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite' }

export function Dashboard() {
  const { user } = useAuth()
  const date = new Date().toISOString().slice(0, 10)
  const goals = useQuery({ queryKey: ['goals', user?.id], queryFn: () => nutritionService.goals(user!.id), enabled: !!user })
  const items = useQuery({ queryKey: ['items', user?.id, date], queryFn: () => nutritionService.dayItems(user!.id, date), enabled: !!user })
  const water = useQuery({ queryKey: ['water', user?.id, date], queryFn: () => nutritionService.water(user!.id, date), enabled: !!user })
  const total = sumNutrients(items.data ?? [])
  const goal = goals.data ?? fallbackGoal
  const waterTotal = (water.data ?? []).reduce((n, log) => n + Number(log.amount_ml), 0)
  const caloriesPct = Math.min(Math.round((total.calories / goal.calories) * 100), 100)
  const formattedDate = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())

  return <section>
    <header className="dashboard-header">
      <div><p className="eyebrow"><CalendarDays size={12}/> {formattedDate}</p><h1 className="page-title">{getGreeting()}, <span>vamos cuidar de você.</span></h1><p className="page-subtitle">Seu progresso de hoje, em uma visão simples e leve.</p></div>
      <div className="header-actions"><OfflineStatus /><Link className="header-add" to="/diario"><Plus size={18}/> Registrar</Link></div>
    </header>

    <div className="dashboard-grid-top">
      <article className="today-hero">
        <div className="hero-glow hero-glow-one"/><div className="hero-glow hero-glow-two"/>
        <div className="hero-copy"><div className="hero-kicker"><Sparkles size={14}/> Seu ritmo de hoje</div><h2>Pequenas escolhas<br/><em>criam grandes mudanças.</em></h2><p>{items.data?.length ?? 0} alimento(s) registrado(s) até agora.</p><Link to="/diario" className="hero-link">Ver meu diário <ArrowRight size={16}/></Link></div>
        <div className="calorie-orbit" style={{ '--orbit-progress': `${caloriesPct * 3.6}deg` } as React.CSSProperties}><div className="orbit-inner"><small>calorias</small><strong>{br(total.calories)}</strong><span>de {br(goal.calories)} kcal</span></div></div>
      </article>
      <article className="water-hero"><div className="water-hero-top"><span className="water-icon"><Droplets size={20}/></span><span className="water-status">{Math.round((waterTotal / goal.water_ml) * 100)}%</span></div><p>Hidratação</p><h2>{br(waterTotal)} <small>ml</small></h2><div className="water-scale"><span style={{ width: `${Math.min(100, Math.round((waterTotal / goal.water_ml) * 100))}%` }}/></div><div className="water-hero-foot"><span>Meta: {br(goal.water_ml)} ml</span><Link to="/diario">Adicionar <Plus size={13}/></Link></div></article>
    </div>

    <section className="dashboard-section"><div className="section-title-row"><div><p className="eyebrow">Nutrientes</p><h2 className="section-heading">O que compõe o seu dia</h2></div><Link to="/diario" className="section-link">Detalhes <ArrowRight size={15}/></Link></div><div className="metric-grid"><MetricCard label="Proteínas" value={total.protein} goal={goal.protein} unit="g" color="#5f91ed" icon={Utensils}/><MetricCard label="Carboidratos" value={total.carbs} goal={goal.carbs} unit="g" color="#d79b35" icon={Wheat}/><MetricCard label="Gorduras" value={total.fat} goal={goal.fat} unit="g" color="#a675d4" icon={Flame}/><MetricCard label="Fibras" value={total.fiber} goal={goal.fiber} unit="g" color="#6eaa4e" icon={Leaf}/></div></section>

    <section className="bottom-summary-grid"><article className="quick-actions-card"><div className="section-title-row"><div><p className="eyebrow">Atalhos</p><h2 className="section-heading">Continue de onde parou</h2></div></div><div className="quick-actions"><Link to="/diario" className="quick-action"><span className="quick-action-icon quick-action-green"><Utensils size={18}/></span><span><strong>Registrar refeição</strong><small>Adicione o que comeu</small></span><ArrowRight size={17}/></Link><Link to="/adicionar" className="quick-action"><span className="quick-action-icon quick-action-orange"><Plus size={18}/></span><span><strong>Novo alimento</strong><small>Cadastre sua base</small></span><ArrowRight size={17}/></Link></div></article><article className="insight-card"><div className="insight-icon"><Sparkles size={18}/></div><div><p className="eyebrow">Seu insight</p><h2>Consistência vale mais que perfeição.</h2><p>Registre o que puder. Um diário honesto é o melhor ponto de partida.</p></div></article></section>
  </section>
}
