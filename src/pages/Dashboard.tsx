import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CalendarDays, Droplets, Flame, Leaf, Plus, Sparkles, Utensils, Wheat } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { MetricCard } from '../components/MetricCard'
import { OfflineStatus } from '../components/OfflineStatus'
import { useAuth } from '../hooks/useAuth'
import { br, sumNutrients } from '../lib/nutrition'
import { nutritionService } from '../services/nutrition-service'

const fallbackGoal = { calories: 2000, protein: 120, carbs: 250, fat: 65, fiber: 30, waterMl: 2500 }

const localIsoDate = (date = new Date()) => {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

const getGreeting = () => {
  const hour = new Date().getHours()
  return hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
}

export function Dashboard() {
  const { user } = useAuth()
  const date = localIsoDate()
  const userId = user?.uid
  const goals = useQuery({ queryKey: ['goals', userId], queryFn: () => nutritionService.goals(userId!), enabled: Boolean(userId) })
  const items = useQuery({ queryKey: ['items', userId, date], queryFn: () => nutritionService.dayItems(userId!, date), enabled: Boolean(userId) })
  const water = useQuery({ queryKey: ['water', userId, date], queryFn: () => nutritionService.water(userId!, date), enabled: Boolean(userId) })
  const total = sumNutrients(items.data ?? [])
  const goal = goals.data ?? fallbackGoal
  const waterTotal = (water.data ?? []).reduce((sum, log) => sum + log.amountMl, 0)
  const caloriesPct = Math.min(Math.round((total.calories / Math.max(goal.calories, 1)) * 100), 100)
  const waterPct = Math.min(Math.round((waterTotal / Math.max(goal.waterMl, 1)) * 100), 100)
  const formattedDate = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())

  return <section>
    <header className="dashboard-header">
      <div>
        <p className="eyebrow"><CalendarDays size={12} /> {formattedDate}</p>
        <h1 className="page-title">{getGreeting()}, <span>vamos cuidar de você.</span></h1>
        <p className="page-subtitle">Seu progresso de hoje, em uma visão simples e leve.</p>
      </div>
      <div className="header-actions"><OfflineStatus /><Link className="header-add" to="/diario"><Plus size={18} /> Registrar</Link></div>
    </header>

    <div className="dashboard-grid-top">
      <article className="today-hero">
        <div className="hero-glow hero-glow-one" /><div className="hero-glow hero-glow-two" />
        <div className="hero-copy">
          <div className="hero-kicker"><Sparkles size={14} /> Seu ritmo de hoje</div>
          <h2>Pequenas escolhas<br /><em>criam grandes mudanças.</em></h2>
          <p>{items.data?.length ?? 0} alimento(s) registrado(s) até agora.</p>
          <Link to="/diario" className="hero-link">Ver meu diário <ArrowRight size={16} /></Link>
        </div>
        <div className="calorie-orbit" style={{ '--orbit-progress': `${caloriesPct * 3.6}deg` } as CSSProperties}>
          <div className="orbit-inner"><small>calorias</small><strong>{br(total.calories)}</strong><span>de {br(goal.calories)} kcal</span></div>
        </div>
      </article>
      <article className="water-hero">
        <div className="water-hero-top"><span className="water-icon"><Droplets size={20} /></span><span className="water-status">{waterPct}%</span></div>
        <p>Hidratação</p><h2>{br(waterTotal)} <small>ml</small></h2>
        <div className="water-scale"><span style={{ width: `${waterPct}%` }} /></div>
        <div className="water-hero-foot"><span>Meta: {br(goal.waterMl)} ml</span><Link to="/diario">Adicionar <Plus size={13} /></Link></div>
      </article>
    </div>

    <section className="dashboard-section">
      <div className="section-title-row"><div><p className="eyebrow">Nutrientes</p><h2 className="section-heading">O que compõe o seu dia</h2></div><Link to="/diario" className="section-link">Detalhes <ArrowRight size={15} /></Link></div>
      <div className="metric-grid">
        <MetricCard label="Proteínas" value={total.protein} goal={goal.protein} unit="g" color="#5f91ed" icon={Utensils} />
        <MetricCard label="Carboidratos" value={total.carbs} goal={goal.carbs} unit="g" color="#d79b35" icon={Wheat} />
        <MetricCard label="Gorduras" value={total.fat} goal={goal.fat} unit="g" color="#a675d4" icon={Flame} />
        <MetricCard label="Fibras" value={total.fiber} goal={goal.fiber} unit="g" color="#6eaa4e" icon={Leaf} />
      </div>
    </section>

    <section className="bottom-summary-grid">
      <article className="quick-actions-card"><div className="section-title-row"><div><p className="eyebrow">Atalhos</p><h2 className="section-heading">Continue de onde parou</h2></div></div><div className="quick-actions"><Link to="/diario" className="quick-action"><span className="quick-action-icon quick-action-green"><Utensils size={18} /></span><span><strong>Registrar refeição</strong><small>Adicione o que comeu</small></span><ArrowRight size={17} /></Link><Link to="/listas" className="quick-action"><span className="quick-action-icon quick-action-orange"><Plus size={18} /></span><span><strong>Minhas listas</strong><small>Veja e cadastre alimentos</small></span><ArrowRight size={17} /></Link></div></article>
      <article className="insight-card"><div className="insight-icon"><Sparkles size={18} /></div><div><p className="eyebrow">Seu insight</p><h2>Consistência vale mais que perfeição.</h2><p>Registre o que puder. Um diário honesto é o melhor ponto de partida.</p></div></article>
    </section>
  </section>
}
