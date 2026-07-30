import {
  getCachedCatalogFoods,
  getCachedCatalogMetadata,
  replaceCachedCatalogFoods,
} from './offline'

/**
 * The public catalogue is deliberately independent from Firestore.  Keeping the
 * shape here (instead of a component) makes the generated JSON, IndexedDB cache
 * and search layer agree on the same contract.
 */
export type CatalogFood = {
  externalId: string
  name: string
  nameNormalized: string
  searchKeywords: string[]
  category: string | null
  brand: string | null
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  saturatedFat?: number
  sugar?: number
  sodium?: number
  baseUnit: 'g' | 'ml'
  unitWeightG: number | null
  portionWeightG: number | null
  source: string | null
  language: string | null
  isActive: boolean
}

export type FoodCatalogVersion = {
  version: string
  updatedAt: string
  totalFoods: number
}

export type CatalogLoadResult = {
  foods: CatalogFood[]
  version: FoodCatalogVersion
  fromCache: boolean
  updated: boolean
  stale: boolean
  error?: Error
}

export type LoadFoodCatalogOptions = {
  force?: boolean
  fetcher?: typeof fetch
}

type CatalogPayload = CatalogFood[] | { foods?: CatalogFood[] }
type CatalogRecord = Record<string, unknown>

const CATALOG_METADATA_KEY = 'public-food-catalog'
const FALSE_VALUES = new Set(['0', 'false', 'inativo', 'inactive', 'nao', 'não', 'no'])

const stringValue = (value: unknown) => typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim()

const nullableString = (value: unknown) => {
  const text = stringValue(value)
  return text || null
}

const normalizeKey = (value: string) => normalizeFoodName(value).replace(/[^a-z0-9]/g, '')

const pickValue = (record: CatalogRecord, aliases: string[]) => {
  for (const alias of aliases) {
    if (alias in record) return record[alias]
  }

  const normalizedAliases = new Set(aliases.map(normalizeKey))
  return Object.entries(record).find(([key]) => normalizedAliases.has(normalizeKey(key)))?.[1]
}

const toNonNegativeNumber = (value: unknown, fallback = 0) => {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.max(0, value) : fallback

  const text = stringValue(value)
    .replace(/\s/g, '')
    .replace(/[^0-9,.-]/g, '')

  if (!text) return fallback

  const comma = text.lastIndexOf(',')
  const dot = text.lastIndexOf('.')
  const normalized = comma > dot
    ? text.replace(/\./g, '').replace(',', '.')
    : text.replace(/,/g, '')
  const result = Number(normalized)
  return Number.isFinite(result) ? Math.max(0, result) : fallback
}

const toOptionalNumber = (value: unknown) => value == null || stringValue(value) === ''
  ? undefined
  : toNonNegativeNumber(value)

const normalizeBaseUnit = (value: unknown): CatalogFood['baseUnit'] => {
  const unit = normalizeFoodName(stringValue(value))
  return unit === 'ml' || unit.includes('mililit') || unit.includes('millilit') || unit === 'l' || unit.includes('litro')
    ? 'ml'
    : 'g'
}

/** Normalizes display text for accent-insensitive search without changing the original label. */
export function normalizeFoodName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

const tokenize = (value: string) => normalizeFoodName(value).split(' ').filter(Boolean)

/**
 * A compact index used by the local search.  Full phrases keep phrase matches
 * fast, while individual words allow searches such as "queijo" for
 * "Pão de queijo".
 */
export function buildSearchKeywords(name: string, category?: string | null, brand?: string | null): string[] {
  const phrases = [name, category ?? '', brand ?? ''].map(normalizeFoodName).filter(Boolean)
  return [...new Set([...phrases, ...phrases.flatMap(tokenize)])]
}

/**
 * Accepts the camelCase JSON schema as well as common historical/snake_case
 * field names.  The converter uses this function too, so a malformed source
 * cannot create records without a stable external identifier.
 */
export function normalizeCatalogFood<T extends object>(raw: T): CatalogFood {
  const record = raw as CatalogRecord
  const externalId = stringValue(pickValue(record, [
    'externalId', 'external_id', 'codigoOriginal', 'codigo_original', 'codigo', 'código', 'code', 'id',
  ]))
  const name = stringValue(pickValue(record, ['name', 'nome', 'nomeAlimento', 'foodName']))
    .replace(/\s+/g, ' ')

  if (!externalId) throw new Error('O alimento público precisa de um código original (externalId).')
  if (!name) throw new Error(`O alimento público ${externalId} precisa de um nome.`)

  const category = nullableString(pickValue(record, ['category', 'categoria', 'grupo']))
  const brand = nullableString(pickValue(record, ['brand', 'marca']))
  const givenKeywords = pickValue(record, ['searchKeywords', 'search_keywords'])
  const extraKeywords = Array.isArray(givenKeywords)
    ? givenKeywords.filter((keyword): keyword is string => typeof keyword === 'string').map(normalizeFoodName)
    : typeof givenKeywords === 'string' ? tokenize(givenKeywords) : []
  const isActiveValue = pickValue(record, ['isActive', 'is_active', 'active', 'ativo', 'status', 'estado'])
  const normalizedIsActive = normalizeFoodName(stringValue(isActiveValue))

  return {
    externalId,
    name,
    nameNormalized: normalizeFoodName(name),
    searchKeywords: [...new Set([...buildSearchKeywords(name, category, brand), ...extraKeywords.filter(Boolean)])],
    category,
    brand,
    calories: toNonNegativeNumber(pickValue(record, ['calories', 'calorias', 'calorias100g', 'kcal', 'energiaKcal', 'energyKcal'])),
    protein: toNonNegativeNumber(pickValue(record, ['protein', 'proteina', 'proteínas', 'proteinas', 'proteina100g'])),
    carbs: toNonNegativeNumber(pickValue(record, ['carbs', 'carbohydrates', 'carboidratos', 'carboidrato', 'carboidratos100g'])),
    fat: toNonNegativeNumber(pickValue(record, ['fat', 'fats', 'gordura', 'gorduras', 'lipidios', 'lipídios', 'fat100g'])),
    fiber: toNonNegativeNumber(pickValue(record, ['fiber', 'fibre', 'fibra', 'fibras', 'fiber100g'])),
    saturatedFat: toOptionalNumber(pickValue(record, ['saturatedFat', 'saturated_fat', 'gorduraSaturada', 'gordurasSaturadas'])),
    sugar: toOptionalNumber(pickValue(record, ['sugar', 'sugars', 'acucar', 'açúcar', 'acucares', 'açúcares'])),
    sodium: toOptionalNumber(pickValue(record, ['sodium', 'sodio', 'sódio'])),
    baseUnit: normalizeBaseUnit(pickValue(record, ['baseUnit', 'base_unit', 'unidadeBase', 'unidade_base', 'unit'])),
    unitWeightG: toOptionalNumber(pickValue(record, ['unitWeightG', 'unit_weight_g', 'pesoUnidade', 'peso_unidade'])) ?? null,
    portionWeightG: toOptionalNumber(pickValue(record, ['portionWeightG', 'portion_weight_g', 'pesoPorcao', 'peso_porção', 'pesoPorção'])) ?? null,
    source: nullableString(pickValue(record, ['source', 'fonte'])),
    language: nullableString(pickValue(record, ['language', 'nameLanguage', 'name_language', 'idioma', 'idiomaNome'])),
    isActive: !FALSE_VALUES.has(normalizedIsActive),
  }
}

/**
 * Replaces matching records by `externalId` and appends new records.  It also
 * removes duplicates already present in either input, which makes repeated
 * imports idempotent.
 */
export function mergeCatalogFoods<TExisting extends object, TIncoming extends object>(
  existing: readonly TExisting[],
  incoming: readonly TIncoming[],
): CatalogFood[] {
  const merged: CatalogFood[] = []
  const positionByExternalId = new Map<string, number>()

  for (const raw of [...existing, ...incoming]) {
    const food = normalizeCatalogFood(raw)
    const existingPosition = positionByExternalId.get(food.externalId)
    if (existingPosition === undefined) {
      positionByExternalId.set(food.externalId, merged.length)
      merged.push(food)
    } else {
      merged[existingPosition] = food
    }
  }

  return merged
}

export const catalogAssetUrl = (fileName: 'foods.json' | 'foods-version.json') => {
  const base = import.meta.env.BASE_URL || '/'
  return `${base.endsWith('/') ? base : `${base}/`}data/${fileName}`
}

export function normalizeFoodCatalogVersion(value: unknown): FoodCatalogVersion {
  const record = value && typeof value === 'object' ? value as CatalogRecord : {}
  const version = stringValue(record.version) || '0.0.0'
  const updatedAt = stringValue(record.updatedAt) || new Date(0).toISOString().slice(0, 10)
  return {
    version,
    updatedAt,
    totalFoods: Math.floor(toNonNegativeNumber(record.totalFoods)),
  }
}

const extractFoods = (payload: CatalogPayload) => Array.isArray(payload) ? payload : payload.foods ?? []

async function fetchJson<T>(fetcher: typeof fetch, fileName: 'foods.json' | 'foods-version.json'): Promise<T> {
  const response = await fetcher(catalogAssetUrl(fileName), { cache: 'no-cache' })
  if (!response.ok) throw new Error(`Não foi possível carregar ${fileName} (${response.status}).`)
  return response.json() as Promise<T>
}

/** Fetches only the small version file, allowing callers to decide whether a full update is necessary. */
export async function fetchFoodCatalogVersion(fetcher: typeof fetch = fetch): Promise<FoodCatalogVersion> {
  return normalizeFoodCatalogVersion(await fetchJson<unknown>(fetcher, 'foods-version.json'))
}

export async function fetchFoodCatalog(fetcher: typeof fetch = fetch): Promise<CatalogFood[]> {
  const payload = await fetchJson<CatalogPayload>(fetcher, 'foods.json')
  return mergeCatalogFoods([], extractFoods(payload) as CatalogRecord[])
}

/** Returns the last successfully cached public catalogue without making a network request. */
export async function getCachedFoodCatalog(): Promise<CatalogFood[]> {
  return getCachedCatalogFoods()
}

/**
 * Keeps the 7k-item catalogue in IndexedDB and downloads it again only when
 * `foods-version.json` changes.  If an update fails after a previous download,
 * callers still receive the cache and can show an offline/stale indicator.
 */
export async function loadFoodCatalog(options: LoadFoodCatalogOptions = {}): Promise<CatalogLoadResult> {
  const fetcher = options.fetcher ?? fetch
  const [cachedFoods, cachedMetadata] = await Promise.all([
    getCachedCatalogFoods(),
    getCachedCatalogMetadata(CATALOG_METADATA_KEY),
  ])

  let remoteVersion: FoodCatalogVersion
  try {
    remoteVersion = await fetchFoodCatalogVersion(fetcher)
  } catch (error) {
    if (cachedFoods.length > 0 && cachedMetadata) {
      return {
        foods: cachedFoods,
        version: cachedMetadata,
        fromCache: true,
        updated: false,
        stale: true,
        error: error instanceof Error ? error : new Error('Não foi possível atualizar o catálogo.'),
      }
    }
    throw error
  }

  const cacheMatchesRemote = cachedMetadata?.version === remoteVersion.version
    && cachedMetadata.totalFoods === remoteVersion.totalFoods

  if (!options.force && cacheMatchesRemote && cachedFoods.length === remoteVersion.totalFoods) {
    return { foods: cachedFoods, version: remoteVersion, fromCache: true, updated: false, stale: false }
  }

  try {
    const foods = await fetchFoodCatalog(fetcher)
    await replaceCachedCatalogFoods(foods, {
      key: CATALOG_METADATA_KEY,
      ...remoteVersion,
    })
    return { foods, version: remoteVersion, fromCache: false, updated: true, stale: false }
  } catch (error) {
    if (cachedFoods.length > 0 && cachedMetadata) {
      return {
        foods: cachedFoods,
        version: cachedMetadata,
        fromCache: true,
        updated: false,
        stale: true,
        error: error instanceof Error ? error : new Error('Não foi possível atualizar o catálogo.'),
      }
    }
    throw error
  }
}
