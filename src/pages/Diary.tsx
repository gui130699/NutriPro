import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, ChevronLeft, ChevronRight, Droplets, Minus, Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { mealIcons } from '../data/meal-icons'
import { useAuth } from '../hooks/useAuth'
import { localIsoDate } from '../lib/dates'
import { loadFoodCatalog, normalizeFoodName } from '../lib/food-catalog'
import { searchCatalogFoods } from '../lib/food-search'
import { mergePublicFoodWithOverride } from '../lib/food-overrides'
import { resolveMealIconKey, resolveMealTypeSnapshot } from '../lib/meal-types'
import { availableFoodUnits, br } from '../lib/nutrition'
import type { Food, MealItem, Unit } from '../lib/types'
import { nutritionService } from '../services/nutrition-service'

type DeleteAction = { kind: 'item'; id: string } | { kind: 'water'; id: string } | null
type MealGroup = { key: string; id: string | null; name: string; icon: string; color: string | null; items: MealItem[]; isActive: boolean }

function matchesFood(food: Food, query: string) {
  const terms = normalizeFoodName(query).split(' ').filter(Boolean)
  const value = normalizeFoodName([food.name, food.brand ?? '', food.category ?? ''].join(' '))
  return terms.every((term) => value.includes(term))
}

export function Diary() {
  const { user } = useAuth()
  const userId = user?.uid
  const client = useQueryClient()
  const [day, setDay] = useState(() => new Date())
  const [foodQuery, setFoodQuery] = useState('')
  const [selectedFood, setSelectedFood] = useState<Food | null>(null)
  const [quantity, setQuantity] = useState('100')
  const [unit, setUnit] = useState<Unit>('g')
  const [mealId, setMealId] = useState('')
  const [customWater, setCustomWater] = useState('')
  const [waterError, setWaterError] = useState<string | null>(null)
  const [deleteAction, setDeleteAction] = useState<DeleteAction>(null)
  const date = localIsoDate(day)

  const catalog = useQuery({ queryKey: ['food-catalog'], queryFn: () => loadFoodCatalog(), enabled: Boolean(userId) })
  const privateFoods = useQuery({ queryKey: ['private-foods', userId], queryFn: () => nutritionService.privateFoods(userId!), enabled: Boolean(userId) })
  const overrides = useQuery({ queryKey: ['food-overrides', userId], queryFn: () => nutritionService.foodOverrides(userId!), enabled: Boolean(userId) })
  const meals = useQuery({ queryKey: ['meal-types', userId], queryFn: () => nutritionService.mealTypes(userId!), enabled: Boolean(userId) })
  const items = useQuery({ queryKey: ['items', userId, date], queryFn: () => nutritionService.dayItems(userId!, date), enabled: Boolean(userId) })
  const water = useQuery({ queryKey: ['water', userId, date], queryFn: () => nutritionService.water(userId!, date), enabled: Boolean(userId) })
  const goals = useQuery({ queryKey: ['goals', userId], queryFn: () => nutritionService.goals(userId!), enabled: Boolean(userId) })

  const activeMeals = useMemo(() => (meals.data ?? []).filter((meal) => meal.isActive), [meals.data])
  useEffect(() => {
    if (!mealId && activeMeals.length) setMealId(activeMeals[0].id)
    if (mealId && !activeMeals.some((meal) => meal.id === mealId)) setMealId(activeMeals[0]?.id ?? '')
  }, [activeMeals, mealId])

  const overridesByFood = useMemo(() => new Map((overrides.data ?? []).map((item) => [item.publicFoodId, item])), [overrides.data])
  const publicSearch = useMemo(() => searchCatalogFoods(catalog.data?.foods ?? [], { query: foodQuery, hiddenIds: (overrides.data ?? []).filter((item) => item.isHidden).map((item) => item.publicFoodId), limit: 8 }), [catalog.data?.foods, foodQuery, overrides.data])
  const candidates = useMemo(() => {
    const privateMatches = (privateFoods.data ?? []).filter((food) => matchesFood(food, foodQuery)).slice(0, 8)
    const publicMatches = publicSearch.foods.map((food) => mergePublicFoodWithOverride(food, overridesByFood.get(food.externalId)))
    return [...privateMatches, ...publicMatches].slice(0, 10)
  }, [foodQuery, overridesByFood, privateFoods.data, publicSearch.foods])

  const addItem = useMutation({
    mutationFn: () => {
      const meal = activeMeals.find((item) => item.id === mealId)
      if (!meal) throw new Error('Selecione uma refeição ativa para continuar.')
      if (!selectedFood) throw new Error('Pesquise e selecione um alimento.')
      return nutritionService.addMealItem(userId!, date, meal, selectedFood, Number(quantity.replace(',', '.')), unit)
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['items', userId] })
      setSelectedFood(null)
      setFoodQuery('')
      setQuantity('100')
    },
  })
  const addWater = useMutation({
    mutationFn: (amount: number) => nutritionService.addWater(userId!, amount, date),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['water', userId] })
      setWaterError(null)
    },
  })
  const deleteMutation = useMutation({
    mutationFn: async (action: NonNullable<DeleteAction>) => {
      if (action.kind === 'item') return nutritionService.deleteMealItem(userId!, action.id)
      return nutritionService.deleteWater(userId!, action.id)
    },
    onSuccess: async (_data, action) => {
      await client.invalidateQueries({ queryKey: [action.kind === 'item' ? 'items' : 'water', userId] })
      setDeleteAction(null)
    },
  })

  const grouped = useMemo<MealGroup[]>(() => {
    const allMeals = meals.data ?? []
    const groups = new Map<string, MealGroup>()
    activeMeals.forEach((meal) => groups.set(`id:${meal.id}`, { key: `id:${meal.id}`, id: meal.id, name: meal.name, icon: meal.icon, color: meal.color ?? null, items: [], isActive: true }))
    ;(items.data ?? []).forEach((item) => {
      const snapshot = resolveMealTypeSnapshot(item, allMeals)
      const key = snapshot.mealTypeId && groups.has(`id:${snapshot.mealTypeId}`) ? `id:${snapshot.mealTypeId}` : `snapshot:${snapshot.mealTypeId ?? snapshot.mealNameSnapshot}`
      if (!groups.has(key)) groups.set(key, { key, id: snapshot.mealTypeId, name: snapshot.mealNameSnapshot, icon: snapshot.mealIconSnapshot, color: null, items: [], isActive: false })
      groups.get(key)!.items.push(item)
    })
    return [...groups.values()]
  }, [activeMeals, items.data, meals.data])

  const waterTotal = (water.data ?? []).reduce((sum, item) => sum + item.amountMl, 0)
  const waterGoal = goals.data?.waterMl ?? 2500
  const waterPercent = Math.min(100, Math.round((waterTotal / Math.max(waterGoal, 1)) * 100))
  const dateLabel = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' }).format(day)
  const selectedMeal = activeMeals.find((meal) => meal.id === mealId)
  const selectedFoodUnits = selectedFood ? availableFoodUnits(selectedFood) : ['g', 'kg'] as Unit[]
  const invalidUnit = Boolean(selectedFood) && !selectedFoodUnits.includes(unit)

  const selectFood = (food: Food) => {
    setSelectedFood(food)
    setFoodQuery(food.name)
    setUnit(availableFoodUnits(food)[0])
  }
  const submitWater = () => {
    const amount = Number(customWater.replace(',', '.'))
    if (!Number.isFinite(amount) || amount <= 0) {
      setWaterError('Informe uma quantidade de água maior que zero.')
      return
    }
    addWater.mutate(amount)
    setCustomWater('')
  }
  const changeDay = (amount: number) => setDay((current) => new Date(current.getFullYear(), current.getMonth(), current.getDate() + amount, 12))

  return <section>
    <header className="diary-header"><div><p className="eyebrow">Registro alimentar</p><h1 className="page-title">Seu diário, <span>no seu ritmo.</span></h1><p className="page-subtitle">Faça escolhas conscientes sem transformar alimentação em obrigação.</p></div><div className="diary-date-control"><button aria-label="Dia anterior" onClick={() => changeDay(-1)}><ChevronLeft size={18} /></button><label><CalendarDays size={15} /><input value={date} type="date" onChange={(event) => setDay(new Date(`${event.target.value}T12:00:00`))} /></label><button aria-label="Próximo dia" onClick={() => changeDay(1)}><ChevronRight size={18} /></button></div></header>
    <p className="diary-date-label">{dateLabel}</p>

    <section className="add-meal-card" id="add-meal"><div className="add-meal-title"><span><Plus size={18} /></span><div><h2>Adicionar ao diário</h2><p>Pesquise em todas as listas e registre uma refeição em poucos segundos.</p></div></div><div className="add-meal-form diary-add-grid"><select className="field" value={mealId} onChange={(event) => setMealId(event.target.value)} aria-label="Refeição">{activeMeals.map((meal) => <option key={meal.id} value={meal.id}>{meal.name}</option>)}{!activeMeals.length && <option value="">Crie uma refeição em Listas</option>}</select><div className="food-picker"><label className="list-search"><Search size={16} /><input value={foodQuery} onChange={(event) => { setFoodQuery(event.target.value); if (selectedFood?.name !== event.target.value) setSelectedFood(null) }} placeholder="Pesquisar alimento" aria-label="Pesquisar alimento" /></label>{foodQuery && !selectedFood && <div className="food-picker-results" role="listbox">{candidates.length ? candidates.map((food) => <button type="button" key={`${food.isPublic ? 'public' : 'private'}-${food.id}`} role="option" onClick={() => selectFood(food)}><span><strong>{food.name}</strong><small>{food.category || (food.isPublic ? 'Lista pública' : 'Minha lista')}</small></span><b>{br(food.calories)} kcal</b></button>) : <p>Nenhum alimento encontrado.</p>}</div>}</div><div className="amount-field"><input className="field" type="number" min="0.01" step="0.01" inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} aria-label="Quantidade" /><select value={unit} onChange={(event) => setUnit(event.target.value as Unit)} aria-label="Unidade" disabled={!selectedFood}>{selectedFoodUnits.map((value) => <option key={value} value={value}>{value}</option>)}</select></div><button className="btn btn-primary" disabled={addItem.isPending || !selectedMeal || !selectedFood || invalidUnit} onClick={() => addItem.mutate()}>{addItem.isPending ? 'Registrando…' : <><Plus size={16} /> Adicionar</>}</button></div>{selectedFood && <p className="selected-food-note">Selecionado: <strong>{selectedFood.name}</strong> · medidas disponíveis: {selectedFoodUnits.join(', ')}.</p>}{addItem.error && <p className="form-error">{addItem.error.message}</p>}{catalog.isError && <p className="form-error">O catálogo público está indisponível agora; seus alimentos particulares continuam disponíveis.</p>}</section>

    <section className="diary-content-grid"><div className="meal-list"><div className="section-title-row"><div><p className="eyebrow">Refeições</p><h2 className="section-heading">Como foi o seu dia</h2></div><span className="item-count">{items.data?.length ?? 0} item(ns)</span></div>{grouped.map((group) => <MealSection key={group.key} group={group} onAdd={() => { if (group.id && activeMeals.some((meal) => meal.id === group.id)) setMealId(group.id); document.getElementById('add-meal')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }} onDelete={(id) => setDeleteAction({ kind: 'item', id })} />)}</div>
      <aside className="water-panel"><div className="water-panel-top"><span className="water-panel-icon"><Droplets size={19} /></span><span>{waterTotal ? 'Em progresso' : 'Comece agora'}</span></div><h2>Água para o seu dia</h2><p className="water-number">{br(waterTotal)} <small>ml</small></p><div className="water-ring-wrap"><div className="water-ring" style={{ '--water-progress': `${waterPercent * 3.6}deg` } as CSSProperties}><span><strong>{waterPercent}%</strong><small>da meta</small></span></div><p>Meta diária<br /><strong>{br(waterGoal)} ml</strong></p></div><div className="water-quick-grid">{[200, 300, 500, 1000].map((amount) => <button disabled={addWater.isPending} onClick={() => addWater.mutate(amount)} key={amount}>+ {amount === 1000 ? '1 L' : `${amount} ml`}</button>)}</div><div className="water-custom"><input className="field" value={customWater} onChange={(event) => setCustomWater(event.target.value)} type="number" min="0.01" step="0.01" placeholder="Outro valor" aria-label="Outro valor de água" /><button className="btn btn-soft" type="button" onClick={submitWater} disabled={addWater.isPending}>Adicionar</button></div>{waterError && <p className="form-error">{waterError}</p>}{addWater.error && <p className="form-error">{addWater.error.message}</p>}<div className="water-history">{water.data?.slice(-4).reverse().map((log) => <div key={log.id}><span>{log.loggedAt ? new Date(log.loggedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Agora'}</span><strong>+ {br(log.amountMl)} ml</strong><button type="button" aria-label={`Excluir ${log.amountMl} ml de água`} onClick={() => setDeleteAction({ kind: 'water', id: log.id })}><Minus size={13} /></button></div>)}</div></aside></section>

    <ConfirmDialog open={Boolean(deleteAction)} title={deleteAction?.kind === 'water' ? 'Excluir registro de água?' : 'Excluir lançamento do diário?'} description={deleteAction?.kind === 'water' ? 'A hidratação será atualizada imediatamente.' : 'Os totais deste dia serão recalculados imediatamente.'} confirmLabel="Excluir" danger isConfirming={deleteMutation.isPending} onCancel={() => setDeleteAction(null)} onConfirm={() => deleteAction && deleteMutation.mutate(deleteAction)} />
  </section>
}

function MealSection({ group, onAdd, onDelete }: { group: MealGroup; onAdd: () => void; onDelete: (id: string) => void }) {
  const Icon = mealIcons[resolveMealIconKey(group.icon)]
  const calories = group.items.reduce((sum, item) => sum + item.calories, 0)
  return <article className={`meal-section ${group.isActive ? '' : 'meal-section-legacy'}`}><div className="meal-section-head"><div className="meal-name"><span className="meal-icon" style={{ color: group.color ?? undefined, backgroundColor: group.color ? `${group.color}18` : undefined }}><Icon size={17} /></span><div><h3>{group.name}</h3><p>{group.items.length ? `${group.items.length} item(ns) · ${br(calories)} kcal` : 'Nenhum registro ainda'}</p></div></div>{group.isActive && <button aria-label={`Adicionar em ${group.name}`} className="meal-add" onClick={onAdd}><Plus size={16} /></button>}</div>{group.items.length > 0 ? <div className="meal-item-list">{group.items.map((item) => <div className="meal-item-row" key={item.id}><span className="meal-item-dot" /><div><strong>{item.foodNameSnapshot}</strong><small>{br(item.quantity, 1)} {item.unit} · {br(item.consumedGrams, 0)} g</small></div><b>{br(item.calories)} <small>kcal</small></b><button type="button" className="meal-item-delete" aria-label={`Excluir ${item.foodNameSnapshot}`} onClick={() => onDelete(item.id)}><Trash2 size={14} /></button></div>)}</div> : <div className="meal-empty"><span>+</span><p>Adicione alimentos a esta refeição</p></div>}</article>
}
