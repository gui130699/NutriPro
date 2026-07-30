import { normalizeFoodName, type CatalogFood } from './food-catalog'

export type FoodSearchOptions = {
  query?: string
  category?: string | null
  brand?: string | null
  favoriteIds?: Iterable<string>
  favoritesOnly?: boolean
  hiddenIds?: Iterable<string>
  /** `showHidden` is retained as the UI-facing name used in filters. */
  showHidden?: boolean
  activeOnly?: boolean
  offset?: number
  limit?: number
}

export type FoodSearchResult = {
  foods: CatalogFood[]
  total: number
  offset: number
  limit: number
  hasMore: boolean
}

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })
const words = (value: string) => normalizeFoodName(value).split(' ').filter(Boolean)
const toIdSet = (values: Iterable<string> | undefined) => new Set(values ?? [])
const normalizedField = (value: string | null | undefined) => normalizeFoodName(value ?? '')

function scoreFood(food: CatalogFood, query: string, queryWords: string[]): number {
  if (!query) return 0

  const name = food.nameNormalized
  const category = normalizedField(food.category)
  const brand = normalizedField(food.brand)
  const keywords = food.searchKeywords.map(normalizeFoodName)
  const corpus = [name, category, brand, ...keywords]

  if (!queryWords.every(word => corpus.some(value => value.includes(word)))) return Number.NEGATIVE_INFINITY

  let score = 0
  if (name === query) score += 10_000
  else if (name.startsWith(query)) score += 5_000
  else if (name.includes(query)) score += 2_000
  if (brand === query) score += 600
  else if (brand.includes(query)) score += 300
  if (category === query) score += 200
  else if (category.includes(query)) score += 100
  score += queryWords.reduce((total, word) => total + (name.split(' ').some(token => token.startsWith(word)) ? 25 : 5), 0)
  return score
}

/**
 * Searches the entire in-memory/IndexedDB catalogue.  It returns a bounded
 * page, so callers never need to render thousands of rows at once.
 */
export function searchCatalogFoods(foods: readonly CatalogFood[], options: FoodSearchOptions = {}): FoodSearchResult {
  const query = normalizeFoodName(options.query ?? '')
  const queryWords = words(query)
  const category = normalizedField(options.category)
  const brand = normalizedField(options.brand)
  const favoriteIds = toIdSet(options.favoriteIds)
  const hiddenIds = toIdSet(options.hiddenIds)
  const activeOnly = options.activeOnly ?? true
  const showHidden = options.showHidden ?? false
  const offset = Math.max(0, Math.floor(options.offset ?? 0))
  const limit = Math.min(100, Math.max(1, Math.floor(options.limit ?? 30)))

  const matches = foods
    .map(food => ({ food, score: scoreFood(food, query, queryWords) }))
    .filter(({ food, score }) => {
      if (activeOnly && !food.isActive) return false
      if (!showHidden && hiddenIds.has(food.externalId)) return false
      if (options.favoritesOnly && !favoriteIds.has(food.externalId)) return false
      if (category && !normalizedField(food.category).includes(category)) return false
      if (brand && !normalizedField(food.brand).includes(brand)) return false
      return score !== Number.NEGATIVE_INFINITY
    })
    .sort((left, right) => right.score - left.score || collator.compare(left.food.name, right.food.name))

  return {
    foods: matches.slice(offset, offset + limit).map(({ food }) => food),
    total: matches.length,
    offset,
    limit,
    hasMore: offset + limit < matches.length,
  }
}

/** A shorter alias for components that do not need the catalogue-specific name. */
export const searchFoods = searchCatalogFoods
