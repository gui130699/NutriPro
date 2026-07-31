import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Eye, EyeOff, Heart, LoaderCircle, PencilLine, Plus, RotateCcw, Search, SlidersHorizontal, Star, Trash2, UtensilsCrossed, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { FoodForm, type FoodFormValues } from '../components/foods/FoodForm'
import { MealTypeForm } from '../components/meals/MealTypeForm'
import { mealIcons } from '../data/meal-icons'
import { useAuth } from '../hooks/useAuth'
import { loadFoodCatalog, normalizeFoodName, type CatalogFood } from '../lib/food-catalog'
import { searchCatalogFoods } from '../lib/food-search'
import { mergePublicFoodWithOverride } from '../lib/food-overrides'
import { resolveMealIconKey } from '../lib/meal-types'
import type { Food, MealType } from '../lib/types'
import { nutritionService } from '../services/nutrition-service'

type ListsTab = 'public' | 'mine' | 'meals'
type MySort = 'name' | 'recent' | 'used'
type FoodEditor = { kind: 'create-private' } | { kind: 'edit-private' | 'edit-public'; food: Food } | null
type ConfirmAction = { kind: 'hide-public' | 'delete-private' | 'restore-public' | 'delete-meal'; food?: Food; meal?: MealType } | null

const pageSize = 24
const emptyCatalogFoods: CatalogFood[] = []
const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })

function useDebouncedValue(value: string, delay = 220) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [delay, value])
  return debounced
}

function favoriteKey(source: 'public' | 'private', id: string) {
  return `${source}:${id}`
}

function toPrivateFoodInput(values: FoodFormValues) {
  const { isFavorite: _isFavorite, ...rest } = values
  return {
    ...rest,
    brand: rest.brand?.trim() || null,
    category: rest.category?.trim() || null,
    source: rest.source?.trim() || null,
    notes: rest.notes?.trim() || null,
  }
}

function foodMatchesQuery(food: Food, query: string) {
  const terms = normalizeFoodName(query).split(' ').filter(Boolean)
  if (!terms.length) return true
  const haystack = normalizeFoodName([food.name, food.brand ?? '', food.category ?? ''].join(' '))
  return terms.every((term) => haystack.includes(term))
}

export function Lists() {
  const { user } = useAuth()
  const userId = user?.uid
  const client = useQueryClient()
  const [tab, setTab] = useState<ListsTab>('public')
  const [publicQuery, setPublicQuery] = useState('')
  const [publicCategory, setPublicCategory] = useState('')
  const [publicFavoritesOnly, setPublicFavoritesOnly] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  const [publicLimit, setPublicLimit] = useState(pageSize)
  const [myQuery, setMyQuery] = useState('')
  const [myCategory, setMyCategory] = useState('')
  const [mySource, setMySource] = useState<'all' | 'private' | 'public'>('all')
  const [myFavoritesOnly, setMyFavoritesOnly] = useState(false)
  const [mySort, setMySort] = useState<MySort>('name')
  const [editor, setEditor] = useState<FoodEditor>(null)
  const [detailsFood, setDetailsFood] = useState<Food | null>(null)
  const [confirm, setConfirm] = useState<ConfirmAction>(null)
  const [mealEditor, setMealEditor] = useState<MealType | 'new' | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const catalog = useQuery({ queryKey: ['food-catalog'], queryFn: () => loadFoodCatalog(), enabled: Boolean(userId) })
  const privateFoods = useQuery({ queryKey: ['private-foods', userId], queryFn: () => nutritionService.privateFoods(userId!), enabled: Boolean(userId) })
  const overrides = useQuery({ queryKey: ['food-overrides', userId], queryFn: () => nutritionService.foodOverrides(userId!), enabled: Boolean(userId) })
  const favorites = useQuery({ queryKey: ['food-favorites', userId], queryFn: () => nutritionService.favorites(userId!), enabled: Boolean(userId) })
  const meals = useQuery({ queryKey: ['meal-types', userId], queryFn: () => nutritionService.mealTypes(userId!), enabled: Boolean(userId) })
  const usage = useQuery({ queryKey: ['food-usage', userId], queryFn: () => nutritionService.foodUsageCounts(userId!), enabled: Boolean(userId) })

  const favoriteIds = useMemo(() => new Set((favorites.data ?? []).map((item) => favoriteKey(item.foodSource, item.foodId))), [favorites.data])
  const overridesByFood = useMemo(() => new Map((overrides.data ?? []).map((item) => [item.publicFoodId, item])), [overrides.data])
  const hiddenPublicIds = useMemo(() => (overrides.data ?? []).filter((item) => item.isHidden).map((item) => item.publicFoodId), [overrides.data])
  const publicFoods = catalog.data?.foods ?? emptyCatalogFoods
  const publicCategories = useMemo(() => Array.from(new Set(publicFoods.map((food) => food.category).filter((category): category is string => Boolean(category)))).sort(collator.compare), [publicFoods])
  const debouncedPublicQuery = useDebouncedValue(publicQuery)

  useEffect(() => setPublicLimit(pageSize), [debouncedPublicQuery, publicCategory, publicFavoritesOnly, showHidden])

  const publicSearch = useMemo(() => searchCatalogFoods(publicFoods, {
    query: debouncedPublicQuery,
    category: publicCategory || undefined,
    favoriteIds: (favorites.data ?? []).filter((item) => item.foodSource === 'public').map((item) => item.foodId),
    favoritesOnly: publicFavoritesOnly,
    hiddenIds: hiddenPublicIds,
    showHidden,
    limit: publicLimit,
  }), [debouncedPublicQuery, favorites.data, hiddenPublicIds, publicCategory, publicFavoritesOnly, publicFoods, publicLimit, showHidden])

  const customizedPublicFoods = useMemo(() => (overrides.data ?? []).flatMap((override) => {
    const catalogFood = publicFoods.find((food) => food.externalId === override.publicFoodId)
    return catalogFood ? [mergePublicFoodWithOverride(catalogFood, override, favoriteIds.has(favoriteKey('public', catalogFood.externalId)))] : []
  }), [favoriteIds, overrides.data, publicFoods])
  const allMyFoods = useMemo(() => [
    ...(privateFoods.data ?? []).map((food) => ({ ...food, isFavorite: favoriteIds.has(favoriteKey('private', food.id)) })),
    ...customizedPublicFoods,
  ], [customizedPublicFoods, favoriteIds, privateFoods.data])
  const myCategories = useMemo(() => Array.from(new Set(allMyFoods.map((food) => food.category).filter((category): category is string => Boolean(category)))).sort(collator.compare), [allMyFoods])
  const myFoods = useMemo(() => {
    const visible = allMyFoods.filter((food) => {
      if (!foodMatchesQuery(food, myQuery)) return false
      if (myCategory && food.category !== myCategory) return false
      if (mySource !== 'all' && (mySource === 'public') !== Boolean(food.isPublic)) return false
      return !myFavoritesOnly || Boolean(food.isFavorite)
    })
    return visible.sort((left, right) => {
      if (mySort === 'recent') return String(right.updatedAt ?? right.createdAt ?? '').localeCompare(String(left.updatedAt ?? left.createdAt ?? ''))
      if (mySort === 'used') return (usage.data?.[right.id] ?? 0) - (usage.data?.[left.id] ?? 0) || collator.compare(left.name, right.name)
      return collator.compare(left.name, right.name)
    })
  }, [allMyFoods, myCategory, myFavoritesOnly, myQuery, mySort, mySource, usage.data])

  const invalidateFoods = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['private-foods', userId] }),
      client.invalidateQueries({ queryKey: ['food-overrides', userId] }),
      client.invalidateQueries({ queryKey: ['food-favorites', userId] }),
      client.invalidateQueries({ queryKey: ['food-usage', userId] }),
    ])
  }
  const favoriteMutation = useMutation({
    mutationFn: ({ food, active }: { food: Food; active: boolean }) => nutritionService.setFavorite(userId!, food.id, food.isPublic ? 'public' : 'private', active),
    onSuccess: invalidateFoods,
  })
  const saveFoodMutation = useMutation({
    mutationFn: async ({ values, target }: { values: FoodFormValues; target: NonNullable<FoodEditor> }) => {
      if (target.kind === 'create-private') {
        const id = await nutritionService.createFood(userId!, toPrivateFoodInput(values))
        if (values.isFavorite) await nutritionService.setFavorite(userId!, id, 'private', true)
        return
      }
      if (target.kind === 'edit-private') {
        await nutritionService.updatePrivateFood(userId!, target.food.id, toPrivateFoodInput(values))
        await nutritionService.setFavorite(userId!, target.food.id, 'private', values.isFavorite)
        return
      }
      const { isActive: _isActive, ...override } = toPrivateFoodInput(values)
      await nutritionService.saveFoodOverride(userId!, target.food.id, override)
      await nutritionService.setFavorite(userId!, target.food.id, 'public', values.isFavorite)
    },
    onSuccess: async () => {
      await invalidateFoods()
      setNotice('Alimento salvo com sucesso.')
      setEditor(null)
    },
  })
  const mealMutation = useMutation({
    mutationFn: async (values: { name: string; icon: string; color: string | null; suggestedTime: string | null; order: number; isActive: boolean }) => {
      if (mealEditor === 'new') return nutritionService.createMealType(userId!, { ...values, isDefault: false })
      if (mealEditor) return nutritionService.updateMealType(userId!, mealEditor.id, values)
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['meal-types', userId] })
      setNotice('Refeição salva com sucesso e disponível no diário.')
      setMealEditor(null)
    },
  })
  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => nutritionService.reorderMealTypes(userId!, ids),
    onSuccess: () => client.invalidateQueries({ queryKey: ['meal-types', userId] }),
  })

  const executeConfirm = async () => {
    if (!confirm || !userId) return
    if (confirm.kind === 'hide-public' && confirm.food) await nutritionService.setPublicFoodHidden(userId, confirm.food.id, true)
    if (confirm.kind === 'delete-private' && confirm.food) await nutritionService.softDeletePrivateFood(userId, confirm.food.id)
    if (confirm.kind === 'restore-public' && confirm.food) await nutritionService.restorePublicFood(userId, confirm.food.id)
    if (confirm.kind === 'delete-meal' && confirm.meal) await nutritionService.softDeleteMealType(userId, confirm.meal.id)
    await invalidateFoods()
    await client.invalidateQueries({ queryKey: ['meal-types', userId] })
    setConfirm(null)
  }
  const moveMeal = (mealId: string, direction: -1 | 1) => {
    const ordered = meals.data ?? []
    const index = ordered.findIndex((meal) => meal.id === mealId)
    const nextIndex = index + direction
    if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) return
    const ids = ordered.map((meal) => meal.id)
    ;[ids[index], ids[nextIndex]] = [ids[nextIndex], ids[index]]
    reorderMutation.mutate(ids)
  }

  return <section className="lists-page">
    <header className="lists-header"><div><p className="eyebrow">Organização</p><h1 className="page-title">Suas <span>listas inteligentes.</span></h1><p className="page-subtitle">Explore o catálogo, mantenha seus alimentos e monte as refeições que combinam com a sua rotina.</p></div><button type="button" className="btn btn-primary" onClick={() => { setTab('mine'); setEditor({ kind: 'create-private' }) }}><Plus size={17} /> Novo alimento</button></header>

    <nav className="lists-tabs" aria-label="Seções de listas"><button className={tab === 'public' ? 'is-active' : ''} type="button" onClick={() => setTab('public')}>Lista pública <span>{catalog.data?.version.totalFoods ?? '—'}</span></button><button className={tab === 'mine' ? 'is-active' : ''} type="button" onClick={() => setTab('mine')}>Minha lista <span>{allMyFoods.length}</span></button><button className={tab === 'meals' ? 'is-active' : ''} type="button" onClick={() => setTab('meals')}>Refeições <span>{meals.data?.length ?? '—'}</span></button></nav>
    {notice && <p className="lists-notice" role="status">{notice}<button type="button" aria-label="Fechar confirmação" onClick={() => setNotice(null)}><X size={14} /></button></p>}

    {tab === 'public' && <section className="list-panel">
      <div className="list-panel-heading"><div><h2>Catálogo público</h2><p>{catalog.data?.version.totalFoods ? `${catalog.data.version.totalFoods.toLocaleString('pt-BR')} alimentos disponíveis.` : 'O catálogo público será disponibilizado quando houver uma versão válida.'}</p></div>{catalog.data?.stale && <span className="catalog-stale">Usando versão offline</span>}</div>
      <FoodFilters query={publicQuery} onQueryChange={setPublicQuery} categories={publicCategories} category={publicCategory} onCategoryChange={setPublicCategory} favoritesOnly={publicFavoritesOnly} onFavoritesChange={setPublicFavoritesOnly} showHidden={showHidden} onShowHiddenChange={setShowHidden} />
      {catalog.isLoading && <LoadingState label="Carregando o catálogo para uso offline…" />}
      {catalog.isError && <EmptyState title="Não foi possível carregar o catálogo" detail="Tente novamente quando houver conexão. Se você já o carregou antes, a versão local será utilizada automaticamente." />}
      {!catalog.isLoading && !catalog.isError && !publicFoods.length && <EmptyState title="Nenhum alimento público disponível" detail="Esta versão do catálogo não contém alimentos disponíveis." />}
      {Boolean(publicFoods.length) && <><p className="list-result-count">{publicSearch.total.toLocaleString('pt-BR')} resultado(s) encontrados</p><div className="food-card-grid">{publicSearch.foods.map((catalogFood) => {
        const override = overridesByFood.get(catalogFood.externalId)
        const food = mergePublicFoodWithOverride(catalogFood, override, favoriteIds.has(favoriteKey('public', catalogFood.externalId)))
        return <FoodCard key={catalogFood.externalId} food={food} hidden={Boolean(override?.isHidden)} customized={Boolean(override)} onDetails={() => setDetailsFood(food)} onEdit={() => setEditor({ kind: 'edit-public', food })} onToggleFavorite={() => favoriteMutation.mutate({ food, active: !food.isFavorite })} onHide={() => override?.isHidden ? void nutritionService.setPublicFoodHidden(userId!, food.id, false).then(invalidateFoods) : setConfirm({ kind: 'hide-public', food })} onRestoreOriginal={override ? () => setConfirm({ kind: 'restore-public', food }) : undefined} />
      })}</div>{publicSearch.hasMore && <button type="button" className="load-more-button" onClick={() => setPublicLimit((limit) => limit + pageSize)}>Carregar mais alimentos</button>}</>}
    </section>}

    {tab === 'mine' && <section className="list-panel">
      <div className="list-panel-heading"><div><h2>Minha lista</h2><p>Alimentos particulares, versões personalizadas do catálogo e favoritos da sua conta.</p></div><button className="btn btn-soft" type="button" onClick={() => setEditor({ kind: 'create-private' })}><Plus size={16} /> Criar alimento</button></div>
      <div className="list-filter-row"><label className="list-search"><Search size={17} /><input value={myQuery} onChange={(event) => setMyQuery(event.target.value)} placeholder="Pesquisar na minha lista" /></label><label className="select-filter"><span>Categoria</span><select value={myCategory} onChange={(event) => setMyCategory(event.target.value)}><option value="">Todas</option>{myCategories.map((category) => <option key={category}>{category}</option>)}</select></label><label className="select-filter"><span>Origem</span><select value={mySource} onChange={(event) => setMySource(event.target.value as typeof mySource)}><option value="all">Todas</option><option value="private">Particulares</option><option value="public">Personalizados</option></select></label><label className="select-filter"><span>Ordenar</span><select value={mySort} onChange={(event) => setMySort(event.target.value as MySort)}><option value="name">Nome</option><option value="recent">Mais recentes</option><option value="used">Mais utilizados</option></select></label><label className="filter-toggle"><input type="checkbox" checked={myFavoritesOnly} onChange={(event) => setMyFavoritesOnly(event.target.checked)} /><Star size={15} /> Favoritos</label></div>
      {privateFoods.isLoading || overrides.isLoading ? <LoadingState label="Carregando sua lista…" /> : myFoods.length ? <div className="food-card-grid">{myFoods.map((food) => { const isHidden = Boolean(food.isPublic && overridesByFood.get(food.id)?.isHidden); return <FoodCard key={`${food.isPublic ? 'public' : 'private'}-${food.id}`} food={food} hidden={isHidden} customized={Boolean(food.isPublic)} onDetails={() => setDetailsFood(food)} onEdit={() => setEditor({ kind: food.isPublic ? 'edit-public' : 'edit-private', food })} onToggleFavorite={() => favoriteMutation.mutate({ food, active: !food.isFavorite })} onHide={() => food.isPublic ? (isHidden ? void nutritionService.setPublicFoodHidden(userId!, food.id, false).then(invalidateFoods) : setConfirm({ kind: 'hide-public', food })) : setConfirm({ kind: 'delete-private', food })} onRestoreOriginal={food.isPublic ? () => setConfirm({ kind: 'restore-public', food }) : undefined} /> })}</div> : <EmptyState title="Nenhum alimento encontrado" detail="Crie um alimento particular ou personalize um item da lista pública." />}
    </section>}

    {tab === 'meals' && <section className="list-panel">
      <div className="list-panel-heading"><div><h2>Refeições</h2><p>Escolha nomes, ícones e a ordem em que as refeições aparecem no seu diário.</p></div><button type="button" className="btn btn-primary" onClick={() => setMealEditor('new')}><Plus size={17} /> Nova refeição</button></div>
      {meals.isLoading ? <LoadingState label="Carregando suas refeições…" /> : <div className="meal-types-layout"><div className="meal-types-list">{(meals.data ?? []).map((meal, index) => { const Icon = mealIcons[resolveMealIconKey(meal.icon)]; return <article className={`meal-type-row ${meal.isActive ? '' : 'is-inactive'}`} key={meal.id}><span className="meal-type-row-icon" style={{ color: meal.color ?? undefined, backgroundColor: meal.color ? `${meal.color}18` : undefined }}><Icon size={19} /></span><div><strong>{meal.name}</strong><small>{meal.suggestedTime ? `Horário sugerido: ${meal.suggestedTime}` : 'Sem horário sugerido'} · {meal.isActive ? 'Ativa' : 'Inativa'}</small></div><div className="meal-type-row-actions"><button type="button" aria-label={`Mover ${meal.name} para cima`} onClick={() => moveMeal(meal.id, -1)} disabled={index === 0 || reorderMutation.isPending}><ArrowUp size={15} /></button><button type="button" aria-label={`Mover ${meal.name} para baixo`} onClick={() => moveMeal(meal.id, 1)} disabled={index === (meals.data?.length ?? 0) - 1 || reorderMutation.isPending}><ArrowDown size={15} /></button><button type="button" aria-label={`Editar ${meal.name}`} onClick={() => setMealEditor(meal)}><PencilLine size={15} /></button><button type="button" aria-label={meal.isActive ? `Desativar ${meal.name}` : `Ativar ${meal.name}`} onClick={() => nutritionService.updateMealType(userId!, meal.id, { isActive: !meal.isActive }).then(() => client.invalidateQueries({ queryKey: ['meal-types', userId] }))}>{meal.isActive ? <EyeOff size={15} /> : <Eye size={15} />}</button><button type="button" aria-label={`Excluir ${meal.name}`} className="is-danger" onClick={() => setConfirm({ kind: 'delete-meal', meal })}><Trash2 size={15} /></button></div></article> })}{!(meals.data?.length) && <EmptyState title="Nenhuma refeição disponível" detail="Crie a primeira refeição para começar." />}</div>{mealEditor && <aside className="meal-editor-card"><button className="editor-close" type="button" aria-label="Fechar editor de refeição" onClick={() => setMealEditor(null)}><X size={17} /></button><h3>{mealEditor === 'new' ? 'Nova refeição' : 'Editar refeição'}</h3><MealTypeForm initialValue={mealEditor === 'new' ? undefined : mealEditor} nextOrder={mealEditor === 'new' ? (meals.data?.length ?? 0) : undefined} isSubmitting={mealMutation.isPending} submitLabel={mealEditor === 'new' ? 'Criar refeição' : 'Salvar refeição'} onCancel={() => setMealEditor(null)} onSubmit={async (values) => { await mealMutation.mutateAsync(values) }} /></aside>}</div>}
    </section>}

    <FoodEditorDialog editor={editor} isSubmitting={saveFoodMutation.isPending} error={saveFoodMutation.error instanceof Error ? saveFoodMutation.error.message : null} onClose={() => setEditor(null)} onSubmit={async (values) => { if (editor) await saveFoodMutation.mutateAsync({ values, target: editor }) }} />
    <FoodDetailsDialog food={detailsFood} onClose={() => setDetailsFood(null)} />
    <ConfirmDialog open={Boolean(confirm)} title={confirm?.kind === 'hide-public' ? 'Ocultar alimento da sua lista?' : confirm?.kind === 'restore-public' ? 'Restaurar valores originais?' : confirm?.kind === 'delete-meal' ? 'Excluir esta refeição?' : 'Excluir alimento particular?'} description={confirm?.kind === 'hide-public' ? 'O alimento continuará existindo no catálogo público e poderá ser restaurado depois.' : confirm?.kind === 'restore-public' ? 'As suas personalizações e a ocultação deste alimento serão removidas. O catálogo original continuará intacto.' : confirm?.kind === 'delete-meal' ? 'A refeição deixará de aparecer em novos lançamentos. Os registros antigos do diário permanecem preservados.' : 'O alimento sairá da sua lista, mas os lançamentos antigos do diário continuarão preservados.'} confirmLabel={confirm?.kind === 'hide-public' ? 'Ocultar alimento' : confirm?.kind === 'restore-public' ? 'Restaurar original' : 'Confirmar exclusão'} danger={confirm?.kind !== 'restore-public'} onCancel={() => setConfirm(null)} onConfirm={() => void executeConfirm()} />
  </section>
}

function FoodFilters({ query, onQueryChange, categories, category, onCategoryChange, favoritesOnly, onFavoritesChange, showHidden, onShowHiddenChange }: { query: string; onQueryChange: (value: string) => void; categories: string[]; category: string; onCategoryChange: (value: string) => void; favoritesOnly: boolean; onFavoritesChange: (value: boolean) => void; showHidden: boolean; onShowHiddenChange: (value: boolean) => void }) {
  return <div className="list-filter-row"><label className="list-search"><Search size={17} /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Busque por nome, marca ou categoria" /></label><label className="select-filter"><span>Categoria</span><select value={category} onChange={(event) => onCategoryChange(event.target.value)}><option value="">Todas</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label><label className="filter-toggle"><input type="checkbox" checked={favoritesOnly} onChange={(event) => onFavoritesChange(event.target.checked)} /><Star size={15} /> Favoritos</label><label className="filter-toggle"><input type="checkbox" checked={showHidden} onChange={(event) => onShowHiddenChange(event.target.checked)} /><SlidersHorizontal size={15} /> Mostrar ocultos</label></div>
}

function FoodCard({ food, hidden, customized, onDetails, onEdit, onToggleFavorite, onHide, onRestoreOriginal }: { food: Food; hidden?: boolean; customized?: boolean; onDetails: () => void; onEdit: () => void; onToggleFavorite: () => void; onHide: () => void; onRestoreOriginal?: () => void }) {
  return <article className={`food-list-card ${hidden ? 'is-hidden' : ''}`}>
    <div className="food-list-card-top"><div><div className="food-badges">{food.isPublic ? <span>Lista pública</span> : <span className="food-badge-private">Particular</span>}{customized && <span className="food-badge-custom">Personalizado</span>}{hidden && <span className="food-badge-hidden">Oculto</span>}</div><h3>{food.name}</h3><p>{food.category || 'Sem categoria informada'}{food.brand ? ` · ${food.brand}` : ''}</p></div><button className={`food-favorite-button ${food.isFavorite ? 'is-favorite' : ''}`} aria-label={food.isFavorite ? `Remover ${food.name} dos favoritos` : `Favoritar ${food.name}`} type="button" onClick={onToggleFavorite}><Heart size={17} fill={food.isFavorite ? 'currentColor' : 'none'} /></button></div>
    <div className="food-macro-line"><span><strong>{formatNumber(food.calories)}</strong> kcal</span><span>P {formatNumber(food.protein)} g</span><span>C {formatNumber(food.carbs)} g</span><span>G {formatNumber(food.fat)} g</span><span>F {formatNumber(food.fiber)} g</span></div>
    <p className="food-measurement">{food.baseUnit === 'ml' ? 'Base: 100 ml' : 'Base: 100 g'}{Number(food.portionWeightG) > 0 ? ` · Porção sugerida: ${formatNumber(Number(food.portionWeightG))} g` : ''}</p>
    <p className="food-source">{food.source ? `Fonte: ${food.source}` : 'Dados por 100 g ou 100 ml'}</p>
    <footer><button type="button" onClick={onDetails}><Eye size={15} /> Detalhes</button><button type="button" onClick={onEdit}><PencilLine size={15} /> {food.isPublic ? 'Personalizar' : 'Editar'}</button>{onRestoreOriginal && <button type="button" onClick={onRestoreOriginal}><RotateCcw size={15} /> Original</button>}<button type="button" className={food.isPublic ? '' : 'is-danger'} onClick={onHide}>{food.isPublic ? hidden ? <><RotateCcw size={15} /> Restaurar</> : <><EyeOff size={15} /> Ocultar</> : <><Trash2 size={15} /> Excluir</>}</button></footer>
  </article>
}

function FoodEditorDialog({ editor, isSubmitting, error, onClose, onSubmit }: { editor: FoodEditor; isSubmitting: boolean; error: string | null; onClose: () => void; onSubmit: (values: FoodFormValues) => Promise<void> }) {
  if (!editor) return null
  const isPublic = editor.kind === 'edit-public'
  const isCreate = editor.kind === 'create-private'
  return <div className="editor-backdrop" role="presentation" onMouseDown={onClose}><section className="food-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="food-editor-title" onMouseDown={(event) => event.stopPropagation()}><button type="button" className="editor-close" aria-label="Fechar editor de alimento" onClick={onClose}><X size={17} /></button><p className="eyebrow">{isPublic ? 'Personalização individual' : 'Minha lista'}</p><h2 id="food-editor-title">{isCreate ? 'Novo alimento particular' : isPublic ? 'Personalizar alimento público' : 'Editar alimento particular'}</h2>{isPublic && <p className="editor-helper">Suas mudanças ficam restritas à sua conta. O catálogo público não será alterado.</p>}{error && <p className="form-error">{error}</p>}<FoodForm initialFood={isCreate ? undefined : editor.food} isSubmitting={isSubmitting} submitLabel={isCreate ? 'Salvar alimento' : isPublic ? 'Salvar personalização' : 'Salvar alterações'} onCancel={onClose} onSubmit={onSubmit} /></section></div>
}

function FoodDetailsDialog({ food, onClose }: { food: Food | null; onClose: () => void }) {
  if (!food) return null
  const sourceMayVary = /valor\s+m[eé]dio|conferir\s+(?:r[oó]tulo|fabricante)/iu.test(food.source ?? '')
  return <div className="editor-backdrop" role="presentation" onMouseDown={onClose}><section className="food-details-dialog" role="dialog" aria-modal="true" aria-labelledby="food-details-title" onMouseDown={(event) => event.stopPropagation()}><button type="button" className="editor-close" aria-label="Fechar detalhes" onClick={onClose}><X size={17} /></button><p className="eyebrow">{food.isPublic ? 'Lista pública' : 'Alimento particular'}</p><h2 id="food-details-title">{food.name}</h2><p>{food.category || 'Sem categoria'}{food.brand ? ` · ${food.brand}` : ''}</p><dl><div><dt>Calorias</dt><dd>{formatNumber(food.calories)} kcal</dd></div><div><dt>Proteínas</dt><dd>{formatNumber(food.protein)} g</dd></div><div><dt>Carboidratos</dt><dd>{formatNumber(food.carbs)} g</dd></div><div><dt>Gorduras</dt><dd>{formatNumber(food.fat)} g</dd></div><div><dt>Fibras</dt><dd>{formatNumber(food.fiber)} g</dd></div><div><dt>Unidade-base</dt><dd>{food.baseUnit === 'ml' ? '100 ml' : '100 g'}</dd></div>{Number(food.portionWeightG) > 0 && <div><dt>Porção sugerida</dt><dd>{formatNumber(Number(food.portionWeightG))} g</dd></div>}{Number(food.unitWeightG) > 0 && <div><dt>Peso por unidade</dt><dd>{formatNumber(Number(food.unitWeightG))} g</dd></div>}</dl>{food.source && <p className="food-detail-source">Fonte: {food.source}</p>}{sourceMayVary && <p className="food-detail-warning" role="note">Os valores podem variar conforme a marca ou o modo de preparo. Confira o rótulo antes de usar.</p>}{food.notes && <p className="food-detail-notes">{food.notes}</p>}</section></div>
}

function LoadingState({ label }: { label: string }) {
  return <div className="list-state"><LoaderCircle className="spin" size={22} /><p>{label}</p></div>
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="list-state list-empty"><UtensilsCrossed size={24} /><h3>{title}</h3><p>{detail}</p></div>
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)
}
