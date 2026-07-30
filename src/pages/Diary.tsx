import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, ChevronLeft, ChevronRight, Coffee, Droplets, GlassWater, Moon, Plus, Sparkles, Sun, UtensilsCrossed } from 'lucide-react'
import { useState, type ComponentType } from 'react'
import { useAuth } from '../hooks/useAuth'
import { br } from '../lib/nutrition'
import type { MealItem, Unit } from '../lib/types'
import { nutritionService } from '../services/nutrition-service'

const iso = (d: Date) => d.toISOString().slice(0, 10)
const meals: { name: string; icon: ComponentType<{ size?: number; strokeWidth?: number }>; tone: string }[] = [
  { name: 'Café da manhã', icon: Coffee, tone: 'meal-sun' }, { name: 'Lanche da manhã', icon: Sparkles, tone: 'meal-peach' }, { name: 'Almoço', icon: Sun, tone: 'meal-gold' }, { name: 'Lanche da tarde', icon: GlassWater, tone: 'meal-sky' }, { name: 'Jantar', icon: UtensilsCrossed, tone: 'meal-lilac' }, { name: 'Ceia', icon: Moon, tone: 'meal-night' },
]
type DiaryItem = MealItem & { mealName?: string }

export function Diary() {
  const { user } = useAuth()
  const client = useQueryClient()
  const [day, setDay] = useState(new Date())
  const [custom, setCustom] = useState('')
  const [foodId, setFoodId] = useState('')
  const [quantity, setQuantity] = useState('100')
  const [unit, setUnit] = useState<Unit>('g')
  const [meal, setMeal] = useState('Café da manhã')
  const date = iso(day)
  const foods = useQuery({ queryKey: ['foods'], queryFn: () => nutritionService.foods(), enabled: !!user })
  const items = useQuery({ queryKey: ['items', user?.id, date], queryFn: () => nutritionService.dayItems(user!.id, date), enabled: !!user })
  const water = useQuery({ queryKey: ['water', user?.id, date], queryFn: () => nutritionService.water(user!.id, date), enabled: !!user })
  const addWater = useMutation({ mutationFn: (amount: number) => nutritionService.addWater(user!.id, amount), onSuccess: () => client.invalidateQueries({ queryKey: ['water', user?.id, date] }) })
  const addItem = useMutation({ mutationFn: () => { const food = foods.data?.find((item) => item.id === foodId); if (!food) throw new Error('Selecione um alimento para continuar.'); return nutritionService.addMealItem(user!.id, date, meal, food, Number(quantity), unit) }, onSuccess: () => { client.invalidateQueries({ queryKey: ['items', user?.id, date] }); setFoodId('') } })
  const changeDay = (amount: number) => setDay((current) => new Date(current.getFullYear(), current.getMonth(), current.getDate() + amount))
  const waterTotal = (water.data ?? []).reduce((sum, item) => sum + Number(item.amount_ml), 0)
  const dateLabel = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' }).format(day)
  const groupedItems = (items.data ?? []) as DiaryItem[]

  return <section>
    <header className="diary-header"><div><p className="eyebrow">Registro alimentar</p><h1 className="page-title">Seu diário, <span>no seu ritmo.</span></h1><p className="page-subtitle">Faça escolhas conscientes sem transformar alimentação em obrigação.</p></div><div className="diary-date-control"><button aria-label="Dia anterior" onClick={() => changeDay(-1)}><ChevronLeft size={18}/></button><label><CalendarDays size={15}/><input value={date} type="date" onChange={(event) => setDay(new Date(`${event.target.value}T12:00:00`))}/></label><button aria-label="Próximo dia" onClick={() => changeDay(1)}><ChevronRight size={18}/></button></div></header>
    <p className="diary-date-label">{dateLabel}</p>

    <section className="add-meal-card"><div className="add-meal-title"><span><Plus size={18}/></span><div><h2>Adicionar ao diário</h2><p>Registre uma refeição em poucos segundos.</p></div></div><div className="add-meal-form"><select className="field" value={meal} onChange={(event) => setMeal(event.target.value)}>{meals.map((item) => <option key={item.name}>{item.name}</option>)}</select><select className="field" value={foodId} onChange={(event) => setFoodId(event.target.value)}><option value="">Selecione um alimento</option>{foods.data?.map((food) => <option key={food.id} value={food.id}>{food.name}</option>)}</select><div className="amount-field"><input className="field" type="number" min="0.01" value={quantity} onChange={(event) => setQuantity(event.target.value)}/><select value={unit} onChange={(event) => setUnit(event.target.value as Unit)}>{(['g', 'kg', 'ml', 'l', 'unidade', 'porção'] as Unit[]).map((value) => <option key={value}>{value}</option>)}</select></div><button className="btn btn-primary" disabled={addItem.isPending} onClick={() => addItem.mutate()}>{addItem.isPending ? 'Registrando…' : <><Plus size={16}/> Adicionar</>}</button></div>{addItem.error && <p className="form-error">{addItem.error.message}</p>}</section>

    <section className="diary-content-grid"><div className="meal-list"><div className="section-title-row"><div><p className="eyebrow">Refeições</p><h2 className="section-heading">Como foi o seu dia</h2></div><span className="item-count">{groupedItems.length} item(ns)</span></div>{meals.map((mealType) => <MealSection key={mealType.name} {...mealType} items={groupedItems.filter((item) => item.mealName === mealType.name)} />)}</div>
      <aside className="water-panel"><div className="water-panel-top"><span className="water-panel-icon"><Droplets size={19}/></span><span>{waterTotal ? 'Em progresso' : 'Comece agora'}</span></div><h2>Água para o seu dia</h2><p className="water-number">{br(waterTotal)} <small>ml</small></p><div className="water-ring-wrap"><div className="water-ring" style={{ '--water-progress': `${Math.min(100, (waterTotal / 2500) * 100) * 3.6}deg` } as React.CSSProperties}><span><strong>{Math.min(100, Math.round((waterTotal / 2500) * 100))}%</strong><small>da meta</small></span></div><p>Meta diária<br/><strong>2.500 ml</strong></p></div><div className="water-quick-grid">{[200, 300, 500, 1000].map((amount) => <button disabled={addWater.isPending} onClick={() => addWater.mutate(amount)} key={amount}>+ {amount === 1000 ? '1 L' : `${amount} ml`}</button>)}</div><div className="water-custom"><input className="field" value={custom} onChange={(event) => setCustom(event.target.value)} type="number" placeholder="Outro valor"/><button className="btn btn-soft" onClick={() => { const amount = Number(custom); if (amount) { addWater.mutate(amount); setCustom('') } }}>Adicionar</button></div><div className="water-history">{water.data?.slice(-3).reverse().map((log) => <div key={log.id}><span>{new Date(log.logged_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span><strong>+ {log.amount_ml} ml</strong></div>)}</div></aside></section>
  </section>
}

function MealSection({ name, icon: Icon, tone, items }: { name: string; icon: ComponentType<{ size?: number; strokeWidth?: number }>; tone: string; items: DiaryItem[] }) {
  const calories = items.reduce((sum, item) => sum + Number(item.calories), 0)
  return <article className="meal-section"><div className="meal-section-head"><div className="meal-name"><span className={`meal-icon ${tone}`}><Icon size={17}/></span><div><h3>{name}</h3><p>{items.length ? `${items.length} item(ns) · ${br(calories)} kcal` : 'Nenhum registro ainda'}</p></div></div><button aria-label={`Adicionar em ${name}`} className="meal-add"><Plus size={16}/></button></div>{items.length > 0 ? <div className="meal-item-list">{items.map((item) => <div className="meal-item-row" key={item.id}><span className="meal-item-dot"/><div><strong>{item.food_name_snapshot}</strong><small>{br(item.quantity, 1)} {item.unit} · {br(item.consumed_grams, 0)} g</small></div><b>{br(item.calories)} <small>kcal</small></b></div>)}</div> : <div className="meal-empty"><span>+</span><p>Adicione alimentos a esta refeição</p></div>}</article>
}
