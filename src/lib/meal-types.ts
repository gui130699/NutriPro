import { defaultMealIconKey, isMealIconKey, type MealIconKey } from '../data/meal-icons'

export type MealType = {
  id: string
  userId: string
  name: string
  icon: MealIconKey
  color: string | null
  suggestedTime: string | null
  order: number
  isActive: boolean
  isDefault: boolean
  createdAt?: string
  updatedAt?: string
}

/** Fields edited in the meal type form before the user and document id are added. */
export type MealTypeDraft = Pick<
  MealType,
  'name' | 'icon' | 'color' | 'suggestedTime' | 'order' | 'isActive'
>

export type MealTypeInput = MealTypeDraft

/** Minimal shape accepted from the existing persisted `src/lib/types` model. */
export type MealTypeReference = {
  id: string
  name: string
  icon: string
}

export type MealTypeDraftInput = {
  name?: string
  icon?: string
  color?: string | null
  suggestedTime?: string | null
  order?: number
  isActive?: boolean
}

export type MealTypeFallback = Partial<Omit<MealType, 'icon'>> & { icon?: string }

/** Shape written to Firestore; timestamps are assigned by the service. */
export type MealTypeFirestoreData = Omit<MealType, 'id' | 'createdAt' | 'updatedAt'>

export type MealTypeFirestoreInput = {
  userId: string
  name: string
  icon: string
  color?: string | null
  suggestedTime?: string | null
  order: number
  isActive: boolean
  isDefault: boolean
}

export type MealTypeSnapshot = {
  mealTypeId: string | null
  mealNameSnapshot: string
  mealIconSnapshot: MealIconKey
}

export type DefaultMealType = Omit<MealType, 'userId' | 'createdAt' | 'updatedAt'>

/**
 * The first-access meal set. IDs are stable preset keys; `createDefaultMealTypes`
 * turns them into per-user document IDs for idempotent creation.
 */
export const DEFAULT_MEAL_TYPES: readonly DefaultMealType[] = [
  {
    id: 'breakfast',
    name: 'Café da manhã',
    icon: 'coffee',
    color: '#D97706',
    suggestedTime: '07:00',
    order: 0,
    isActive: true,
    isDefault: true,
  },
  {
    id: 'morning-snack',
    name: 'Lanche da manhã',
    icon: 'sparkles',
    color: '#D97756',
    suggestedTime: '10:00',
    order: 1,
    isActive: true,
    isDefault: true,
  },
  {
    id: 'lunch',
    name: 'Almoço',
    icon: 'sun',
    color: '#CA8A04',
    suggestedTime: '12:30',
    order: 2,
    isActive: true,
    isDefault: true,
  },
  {
    id: 'afternoon-snack',
    name: 'Lanche da tarde',
    icon: 'water',
    color: '#0284C7',
    suggestedTime: '16:00',
    order: 3,
    isActive: true,
    isDefault: true,
  },
  {
    id: 'dinner',
    name: 'Jantar',
    icon: 'dinner',
    color: '#7C3AED',
    suggestedTime: '20:00',
    order: 4,
    isActive: true,
    isDefault: true,
  },
  {
    id: 'supper',
    name: 'Ceia',
    icon: 'moon',
    color: '#475569',
    suggestedTime: '22:00',
    order: 5,
    isActive: true,
    isDefault: true,
  },
]

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')

const normalizeToken = (value: string) => normalizeText(value).replace(/\s/g, '')

const mealPresetAliases: Readonly<Record<string, DefaultMealType['id']>> = {
  'cafe da manha': 'breakfast',
  breakfast: 'breakfast',
  'lanche da manha': 'morning-snack',
  'morning snack': 'morning-snack',
  almoco: 'lunch',
  lunch: 'lunch',
  'lanche da tarde': 'afternoon-snack',
  'afternoon snack': 'afternoon-snack',
  jantar: 'dinner',
  dinner: 'dinner',
  ceia: 'supper',
  supper: 'supper',
}

const mealIconAliases: Readonly<Record<string, MealIconKey>> = {
  coffee: 'coffee',
  cafe: 'coffee',
  cupsoda: 'soda',
  soda: 'soda',
  refrigerante: 'soda',
  glasswater: 'water',
  water: 'water',
  agua: 'water',
  milk: 'milk',
  leite: 'milk',
  apple: 'apple',
  maca: 'apple',
  banana: 'banana',
  cherry: 'cherry',
  cereja: 'cherry',
  cerejas: 'cherry',
  salad: 'salad',
  salada: 'salad',
  soup: 'soup',
  sopa: 'soup',
  sandwich: 'sandwich',
  sanduiche: 'sandwich',
  pizza: 'pizza',
  beef: 'beef',
  carne: 'beef',
  drumstick: 'chicken',
  chicken: 'chicken',
  frango: 'chicken',
  fish: 'fish',
  peixe: 'fish',
  egg: 'egg',
  ovo: 'egg',
  wheat: 'wheat',
  trigo: 'wheat',
  croissant: 'croissant',
  cakeslice: 'cake',
  cake: 'cake',
  bolo: 'cake',
  cookie: 'cookie',
  biscoito: 'cookie',
  icecreambowl: 'iceCream',
  icecream: 'iceCream',
  sorvete: 'iceCream',
  utensils: 'utensils',
  talheres: 'utensils',
  utensilscrossed: 'dinner',
  dinner: 'dinner',
  jantar: 'dinner',
  cookingpot: 'pot',
  pot: 'pot',
  panela: 'pot',
  moon: 'moon',
  lua: 'moon',
  sun: 'sun',
  sol: 'sun',
  sunrise: 'sunrise',
  nascidosol: 'sunrise',
  sunset: 'sunset',
  pordosol: 'sunset',
  sparkles: 'sparkles',
  brilhos: 'sparkles',
  dumbbell: 'workout',
  workout: 'workout',
  treino: 'workout',
  heart: 'heart',
  coracao: 'heart',
  star: 'star',
  estrela: 'star',
  clock: 'clock',
  relogio: 'clock',
  plus: 'plus',
  adicionar: 'plus',
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

const firstDefined = (record: Record<string, unknown>, keys: readonly string[]) => {
  for (const key of keys) {
    if (record[key] !== undefined) return record[key]
  }
  return undefined
}

const readString = (record: Record<string, unknown>, keys: readonly string[]) => {
  const value = firstDefined(record, keys)
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

const readNullableString = (record: Record<string, unknown>, keys: readonly string[]) => {
  const value = firstDefined(record, keys)
  if (value === null) return null
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

const readBoolean = (record: Record<string, unknown>, keys: readonly string[]) => {
  const value = firstDefined(record, keys)
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}

const readNonNegativeInteger = (record: Record<string, unknown>, keys: readonly string[]) => {
  const value = firstDefined(record, keys)
  const numeric = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN
  return Number.isFinite(numeric) && numeric >= 0 ? Math.floor(numeric) : undefined
}

const readTimestamp = (record: Record<string, unknown>, keys: readonly string[]) => {
  const value = firstDefined(record, keys)
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value

  const timestamp = asRecord(value)
  return timestamp && typeof timestamp.toDate === 'function'
    ? (timestamp.toDate as () => Date)().toISOString()
    : undefined
}

export const getDefaultMealType = (name: string): DefaultMealType | undefined => {
  const presetId = mealPresetAliases[normalizeText(name)]
  return DEFAULT_MEAL_TYPES.find((mealType) => mealType.id === presetId)
}

/** Turns legacy Lucide names and user-friendly aliases into a persisted key. */
export const resolveMealIconKey = (
  value: unknown,
  fallback: MealIconKey = defaultMealIconKey,
): MealIconKey => {
  if (isMealIconKey(value)) return value
  if (typeof value !== 'string' || !value.trim()) return fallback
  return mealIconAliases[normalizeToken(value)] ?? fallback
}

/** A stable document id allows seeding defaults with `setDoc` without duplicates. */
export const defaultMealTypeDocumentId = (userId: string, presetId: string) =>
  `default_${encodeURIComponent(userId)}_${presetId}`

export const createDefaultMealTypes = (userId: string): MealType[] =>
  DEFAULT_MEAL_TYPES.map((mealType) => ({
    ...mealType,
    id: defaultMealTypeDocumentId(userId, mealType.id),
    userId,
  }))

export const createMealTypeDraft = (
  value: MealTypeDraftInput = {},
): MealTypeDraft => ({
  name: value.name?.trim() ?? '',
  icon: resolveMealIconKey(value.icon),
  color: value.color ?? null,
  suggestedTime: value.suggestedTime ?? null,
  order: Number.isFinite(value.order) && Number(value.order) >= 0 ? Math.floor(Number(value.order)) : 0,
  isActive: value.isActive ?? true,
})

export const mealTypeToFirestore = (mealType: MealTypeFirestoreInput): MealTypeFirestoreData => ({
  userId: mealType.userId,
  name: mealType.name.trim(),
  icon: resolveMealIconKey(mealType.icon),
  color: mealType.color ?? null,
  suggestedTime: mealType.suggestedTime ?? null,
  order: Number.isFinite(mealType.order) && mealType.order >= 0
    ? Math.floor(mealType.order)
    : 0,
  isActive: mealType.isActive,
  isDefault: mealType.isDefault,
})

/**
 * Converts a Firestore document from both the current camelCase model and the
 * previous snake_case / `mealName` shapes. Invalid documents are ignored.
 */
export const resolveMealType = (
  input: unknown,
  fallback: MealTypeFallback = {},
): MealType | null => {
  const record = asRecord(input)
  if (!record) return null

  const id = readString(record, ['id', 'mealTypeId', 'meal_type_id']) ?? fallback.id
  const userId = readString(record, ['userId', 'user_id']) ?? fallback.userId
  const name = readString(record, [
    'name',
    'mealName',
    'meal_name',
    'mealNameSnapshot',
    'meal_name_snapshot',
  ]) ?? fallback.name

  if (!id || !userId || !name) return null

  const preset = getDefaultMealType(name)
  const rawIcon = firstDefined(record, [
    'icon',
    'mealIcon',
    'meal_icon',
    'mealIconSnapshot',
    'meal_icon_snapshot',
  ])

  return {
    id,
    userId,
    name,
    icon: resolveMealIconKey(
      rawIcon,
      resolveMealIconKey(fallback.icon, preset?.icon ?? defaultMealIconKey),
    ),
    color: readNullableString(record, ['color']) ?? fallback.color ?? preset?.color ?? null,
    suggestedTime: readNullableString(record, ['suggestedTime', 'suggested_time'])
      ?? fallback.suggestedTime
      ?? preset?.suggestedTime
      ?? null,
    order: readNonNegativeInteger(record, ['order', 'sortOrder', 'sort_order'])
      ?? fallback.order
      ?? preset?.order
      ?? 0,
    isActive: readBoolean(record, ['isActive', 'is_active']) ?? fallback.isActive ?? true,
    isDefault: readBoolean(record, ['isDefault', 'is_default']) ?? fallback.isDefault ?? false,
    createdAt: readTimestamp(record, ['createdAt', 'created_at']) ?? fallback.createdAt,
    updatedAt: readTimestamp(record, ['updatedAt', 'updated_at']) ?? fallback.updatedAt,
  }
}

export const createMealTypeSnapshot = (
  mealType: MealTypeReference,
): MealTypeSnapshot => ({
  mealTypeId: mealType.id,
  mealNameSnapshot: mealType.name,
  mealIconSnapshot: resolveMealIconKey(mealType.icon),
})

/**
 * Resolves a diary item safely. New entries retain their saved snapshots;
 * old entries containing only `mealName` are mapped to the original defaults.
 */
export const resolveMealTypeSnapshot = (
  input: unknown,
  mealTypes: readonly MealTypeReference[] = [],
): MealTypeSnapshot => {
  const record = asRecord(input)
  if (!record) {
    return {
      mealTypeId: null,
      mealNameSnapshot: 'Refeição',
      mealIconSnapshot: defaultMealIconKey,
    }
  }

  const mealTypeId = readString(record, ['mealTypeId', 'meal_type_id']) ?? null
  const linkedMealType = mealTypeId
    ? mealTypes.find((mealType) => mealType.id === mealTypeId)
    : undefined
  const rawName = readString(record, [
    'mealNameSnapshot',
    'meal_name_snapshot',
    'mealName',
    'meal_name',
  ])
  const preset = rawName ? getDefaultMealType(rawName) : undefined
  const name = rawName ?? linkedMealType?.name ?? preset?.name ?? 'Refeição'
  const rawIcon = firstDefined(record, [
    'mealIconSnapshot',
    'meal_icon_snapshot',
    'mealIcon',
    'meal_icon',
  ])

  return {
    mealTypeId: mealTypeId ?? linkedMealType?.id ?? null,
    mealNameSnapshot: name,
    mealIconSnapshot: resolveMealIconKey(rawIcon, resolveMealIconKey(
      linkedMealType?.icon,
      preset?.icon ?? defaultMealIconKey,
    )),
  }
}
