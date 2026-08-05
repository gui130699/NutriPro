import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QueryConstraint,
} from 'firebase/firestore'
import { localIsoDate } from '../lib/dates'
import {
  foodDensityProfileId,
  foodUnitProfileId,
  isPersistedFoodUnitProfile,
  resolveMealItemUnitSelection,
  validateFoodDensityProfileDraft,
  validateFoodUnitProfileDraft,
} from '../lib/food-units'
import { createDefaultMealTypes, resolveMealIconKey } from '../lib/meal-types'
import {
  cacheFoodDensityProfile,
  cacheFoodUnitProfile,
  cacheFoodUnitProfiles,
  enqueueFoodDensityProfileOperation,
  enqueueFoodUnitProfileOperation,
  getCachedFoodDensityProfile,
  getCachedFoodUnitProfile,
  getCachedFoodUnitProfiles,
  pendingFoodDensityProfileIds,
  pendingFoodUnitProfileIds,
  removeCachedFoodDensityProfile,
  removeCachedFoodUnitProfile,
  syncFoodDensityProfileOperations,
  syncFoodUnitProfileOperations,
} from '../lib/offline'
import type {
  Food,
  FoodDensityProfile,
  FoodDensityProfileDraft,
  FoodFavorite,
  FoodOverride,
  FoodSource,
  FoodUnitProfile,
  FoodUnitProfileDraft,
  Goal,
  MealItem,
  MealItemUnitSelection,
  MealType,
  ThemePreference,
  Unit,
  UserPreferences,
} from '../lib/types'
import { db } from '../lib/firebase'

const firestore = () => {
  if (!db) throw new Error('Configure as variáveis públicas do Firebase antes de usar o NutriPro.')
  return db
}

const timestampToIso = (value: unknown) => {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') return value.toDate().toISOString()
  return undefined
}

const toNumber = (value: unknown) => Number(value ?? 0)

const toNullableNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const toFood = (id: string, data: DocumentData): Food => ({
  id,
  userId: typeof data.userId === 'string' ? data.userId : undefined,
  externalId: typeof data.externalId === 'string' ? data.externalId : undefined,
  name: String(data.name ?? ''),
  brand: data.brand ?? null,
  description: data.description ?? null,
  category: data.category ?? null,
  baseUnit: data.baseUnit ?? data.base_unit ?? 'g',
  calories: toNumber(data.calories),
  protein: toNumber(data.protein),
  carbs: toNumber(data.carbs),
  fat: toNumber(data.fat),
  fiber: toNumber(data.fiber),
  saturatedFat: toNumber(data.saturatedFat ?? data.saturated_fat),
  sugar: toNumber(data.sugar),
  sodium: toNumber(data.sodium),
  unitWeightG: data.unitWeightG ?? data.unit_weight_g ?? null,
  portionWeightG: data.portionWeightG ?? data.portion_weight_g ?? null,
  source: data.source ?? null,
  notes: data.notes ?? null,
  isFavorite: Boolean(data.isFavorite),
  isActive: data.isActive ?? data.is_active ?? true,
  isPublic: data.isPublic ?? data.is_public ?? false,
  createdAt: timestampToIso(data.createdAt ?? data.created_at),
  updatedAt: timestampToIso(data.updatedAt ?? data.updated_at),
})

const toMealItem = (id: string, data: DocumentData): MealItem => ({
  id,
  userId: String(data.userId ?? ''),
  date: String(data.date ?? ''),
  mealTypeId: data.mealTypeId ?? null,
  mealNameSnapshot: data.mealNameSnapshot ?? data.mealName,
  mealIconSnapshot: resolveMealIconKey(data.mealIconSnapshot ?? data.meal_icon_snapshot ?? 'utensils'),
  mealName: data.mealName,
  foodId: data.foodId ?? data.food_id,
  foodSource: data.foodSource ?? 'private',
  foodNameSnapshot: String(data.foodNameSnapshot ?? data.food_name_snapshot ?? ''),
  calories: toNumber(data.calories),
  protein: toNumber(data.protein),
  carbs: toNumber(data.carbs),
  fat: toNumber(data.fat),
  fiber: toNumber(data.fiber),
  saturatedFat: toNumber(data.saturatedFat ?? data.saturated_fat),
  sugar: toNumber(data.sugar),
  sodium: toNumber(data.sodium),
  unitWeightGSnapshot: data.unitWeightGSnapshot ?? data.unit_weight_g_snapshot ?? null,
  quantity: toNumber(data.quantity),
  unit: data.unit as Unit,
  consumedGrams: toNumber(data.consumedGrams ?? data.consumed_grams),
  unitProfileId: typeof (data.unitProfileId ?? data.unit_profile_id) === 'string' ? data.unitProfileId ?? data.unit_profile_id : null,
  unitLabelSnapshot: typeof (data.unitLabelSnapshot ?? data.unit_label_snapshot) === 'string' ? data.unitLabelSnapshot ?? data.unit_label_snapshot : null,
  amountPerUnitSnapshot: toNullableNumber(data.amountPerUnitSnapshot ?? data.amount_per_unit_snapshot),
  baseMeasureSnapshot: (data.baseMeasureSnapshot ?? data.base_measure_snapshot) === 'g' || (data.baseMeasureSnapshot ?? data.base_measure_snapshot) === 'ml'
    ? data.baseMeasureSnapshot ?? data.base_measure_snapshot
    : null,
  consumedBaseAmount: toNullableNumber(data.consumedBaseAmount ?? data.consumed_base_amount),
  createdAt: timestampToIso(data.createdAt ?? data.created_at),
})

const toFoodUnitProfile = (id: string, data: DocumentData, syncStatus: FoodUnitProfile['syncStatus'] = 'synced'): FoodUnitProfile => ({
  id,
  userId: String(data.userId ?? ''),
  foodId: String(data.foodId ?? ''),
  foodSource: data.foodSource === 'public' ? 'public' : 'private',
  name: String(data.name ?? ''),
  singularLabel: String(data.singularLabel ?? data.name ?? ''),
  pluralLabel: typeof data.pluralLabel === 'string' ? data.pluralLabel : null,
  measureType: data.measureType === 'volume' ? 'volume' : 'mass',
  baseMeasure: data.baseMeasure === 'ml' ? 'ml' : 'g',
  amountPerUnit: toNumber(data.amountPerUnit),
  isDefault: Boolean(data.isDefault),
  isActive: data.isActive !== false,
  origin: data.origin === 'catalog' ? 'catalog' : 'user',
  notes: typeof data.notes === 'string' ? data.notes : null,
  createdAt: timestampToIso(data.createdAt),
  updatedAt: timestampToIso(data.updatedAt),
  syncStatus,
})

const toFoodDensityProfile = (id: string, data: DocumentData, syncStatus: FoodDensityProfile['syncStatus'] = 'synced'): FoodDensityProfile => ({
  id,
  userId: String(data.userId ?? ''),
  foodId: String(data.foodId ?? ''),
  foodSource: data.foodSource === 'public' ? 'public' : 'private',
  gramsPerMl: toNumber(data.gramsPerMl),
  source: data.source === 'label' || data.source === 'professional' ? data.source : 'user',
  notes: typeof data.notes === 'string' ? data.notes : null,
  createdAt: timestampToIso(data.createdAt),
  updatedAt: timestampToIso(data.updatedAt),
  syncStatus,
})

const toMealType = (id: string, data: DocumentData): MealType => ({
  id,
  userId: String(data.userId ?? ''),
  name: String(data.name ?? ''),
  icon: resolveMealIconKey(data.icon ?? 'utensils'),
  color: data.color ?? null,
  suggestedTime: data.suggestedTime ?? null,
  order: toNumber(data.order),
  isActive: data.isActive !== false,
  isDefault: Boolean(data.isDefault),
  deletedAt: timestampToIso(data.deletedAt) ?? null,
  createdAt: timestampToIso(data.createdAt),
  updatedAt: timestampToIso(data.updatedAt),
})

const overrideId = (userId: string, publicFoodId: string) => `${userId}_${publicFoodId}`
const favoriteId = (userId: string, source: 'public' | 'private', foodId: string) => `${userId}_${source}_${foodId}`

export type FoodUsageSource = 'public' | 'private'

/**
 * A source-qualified key keeps a private food from being conflated with a
 * public catalog item that happens to have the same id.
 */
export const foodUsageKey = (foodSource: FoodUsageSource, foodId: string) => `${foodSource}:${foodId}`

export const foodUsageDocumentId = (userId: string, foodSource: FoodUsageSource, foodId: string) =>
  `usage_${encodeURIComponent(userId)}_${foodSource}_${encodeURIComponent(foodId)}`

const asFoodUsageSource = (value: unknown): FoodUsageSource => value === 'public' ? 'public' : 'private'

const nonNegativeCount = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0
}

export type SaveFoodUnitProfileOptions = {
  /** The former deterministic id when editing a unit name. It is safely deactivated after replacement. */
  replacesProfileId?: string | null
  /** Allows callers that require a remote write to opt out of the offline queue. */
  queueIfOffline?: boolean
}

export type DeleteFoodUnitProfileResult = 'deleted' | 'deactivated'

const sortFoodUnitProfiles = (profiles: readonly FoodUnitProfile[]) => [...profiles].sort((left, right) =>
  Number(right.isDefault) - Number(left.isDefault)
  || Number(right.isActive) - Number(left.isActive)
  || left.name.localeCompare(right.name, 'pt-BR'),
)

const profileDocument = (profile: FoodUnitProfile) => ({
  userId: profile.userId,
  foodId: profile.foodId,
  foodSource: profile.foodSource,
  name: profile.name,
  singularLabel: profile.singularLabel,
  pluralLabel: profile.pluralLabel ?? null,
  measureType: profile.measureType,
  baseMeasure: profile.baseMeasure,
  amountPerUnit: profile.amountPerUnit,
  isDefault: profile.isDefault,
  isActive: profile.isActive,
  origin: profile.origin,
  notes: profile.notes ?? null,
})

const densityDocument = (profile: FoodDensityProfile) => ({
  userId: profile.userId,
  foodId: profile.foodId,
  foodSource: profile.foodSource,
  gramsPerMl: profile.gramsPerMl,
  source: profile.source,
  notes: profile.notes ?? null,
})

const isOfflineFailure = (error: unknown) => {
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && !navigator.onLine) return true
  const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' ? error.code : ''
  return code === 'unavailable'
    || code === 'deadline-exceeded'
    || code === 'network-request-failed'
    || code.endsWith('/unavailable')
    || code.endsWith('/deadline-exceeded')
}

const failFastWhenOffline = () => {
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && !navigator.onLine) {
    throw Object.assign(new Error('Sem conexão; a operação será sincronizada quando o dispositivo voltar a ficar online.'), { code: 'unavailable' })
  }
}

const withProfileSyncStatus = async (userId: string, profiles: readonly FoodUnitProfile[]) => {
  const pending = await pendingFoodUnitProfileIds(userId)
  return profiles.map((profile) => ({ ...profile, syncStatus: pending.has(profile.id) ? 'pending' as const : 'synced' as const }))
}

const withDensitySyncStatus = async (userId: string, profile: FoodDensityProfile | null) => {
  if (!profile) return null
  const pending = await pendingFoodDensityProfileIds(userId)
  return { ...profile, syncStatus: pending.has(profile.id) ? 'pending' as const : 'synced' as const }
}

const profileFromCache = async (profileId: string) => {
  const cached = await getCachedFoodUnitProfile(profileId)
  return cached ? { ...cached, syncStatus: 'pending' as const } : null
}

async function persistFoodUnitProfile(
  userId: string,
  profile: FoodUnitProfile,
  replacesProfileId?: string | null,
): Promise<FoodUnitProfile> {
  const database = firestore()
  const ref = doc(database, 'foodUnitProfiles', profile.id)
  const peersQuery = query(
    collection(database, 'foodUnitProfiles'),
    where('userId', '==', userId),
    where('foodId', '==', profile.foodId),
    where('foodSource', '==', profile.foodSource),
    where('isActive', '==', true),
  )
  const replacementRef = replacesProfileId && replacesProfileId !== profile.id
    ? doc(database, 'foodUnitProfiles', replacesProfileId)
    : null
  const peerRefs = (await getDocs(peersQuery)).docs.map((peer) => peer.ref)
  let persistedDefault = profile.isDefault

  await runTransaction(database, async (transaction) => {
    const [current, replacement, ...peers] = await Promise.all([
      transaction.get(ref),
      replacementRef ? transaction.get(replacementRef) : Promise.resolve(null),
      ...peerRefs.map((peer) => transaction.get(peer)),
    ])
    if (current.exists() && current.data().userId !== userId) throw new Error('Você não pode alterar esta unidade.')
    if (replacement && replacement.exists() && replacement.data().userId !== userId) throw new Error('Você não pode alterar esta unidade.')

    const inheritedDefault = Boolean(replacement?.exists() && replacement.data().isDefault)
    persistedDefault = profile.isActive && (profile.isDefault || inheritedDefault)
    if (persistedDefault) {
      peers.forEach((peer) => {
        if (peer.exists() && peer.id !== profile.id && peer.data().isDefault === true) transaction.update(peer.ref, { isDefault: false, updatedAt: serverTimestamp() })
      })
    }

    const now = serverTimestamp()
    transaction.set(ref, {
      ...profileDocument({ ...profile, isDefault: persistedDefault }),
      updatedAt: now,
      ...(!current.exists() || current.data().createdAt === undefined ? { createdAt: now } : {}),
    }, { merge: true })
    if (replacementRef && replacement?.exists()) {
      transaction.update(replacementRef, { isActive: false, isDefault: false, updatedAt: now })
    }
  })

  return { ...profile, isDefault: persistedDefault, syncStatus: 'synced' }
}

async function persistFoodDensityProfile(userId: string, profile: FoodDensityProfile): Promise<FoodDensityProfile> {
  const database = firestore()
  const ref = doc(database, 'foodDensityProfiles', profile.id)
  await runTransaction(database, async (transaction) => {
    const current = await transaction.get(ref)
    if (current.exists() && current.data().userId !== userId) throw new Error('Você não pode alterar esta densidade.')
    const now = serverTimestamp()
    transaction.set(ref, {
      ...densityDocument(profile),
      updatedAt: now,
      ...(!current.exists() || current.data().createdAt === undefined ? { createdAt: now } : {}),
    }, { merge: true })
  })
  return { ...profile, syncStatus: 'synced' }
}

const cacheFoodUnitProfileWithDefault = async (profile: FoodUnitProfile) => {
  if (!profile.isDefault) {
    await cacheFoodUnitProfile(profile)
    return
  }
  const peers = await getCachedFoodUnitProfiles(profile.userId, profile.foodId, profile.foodSource, true)
  await cacheFoodUnitProfiles([
    ...peers.filter((peer) => peer.id !== profile.id).map((peer) => ({ ...peer, isDefault: false })),
    profile,
  ])
}

async function persistFoodUnitProfileState(userId: string, profileId: string, isActive: boolean): Promise<FoodUnitProfile> {
  const ref = doc(firestore(), 'foodUnitProfiles', profileId)
  const current = await getDoc(ref)
  if (!current.exists() || current.data().userId !== userId) throw new Error('Você não pode alterar esta unidade.')
  const profile = toFoodUnitProfile(current.id, current.data())
  const updated: FoodUnitProfile = {
    ...profile,
    isActive,
    isDefault: isActive ? profile.isDefault : false,
    updatedAt: new Date().toISOString(),
    syncStatus: 'synced',
  }
  await updateDoc(ref, {
    isActive: updated.isActive,
    isDefault: updated.isDefault,
    updatedAt: serverTimestamp(),
  })
  return updated
}

const foodUnitProfileHasSnapshots = async (userId: string, profileId: string) => {
  const items = collection(firestore(), 'mealItems')
  const canonical = await getDocs(query(
    items,
    where('userId', '==', userId),
    where('unitProfileId', '==', profileId),
    limit(1),
  ))
  if (canonical.docs.length > 0) return true

  // Temporary compatibility for documents created before the canonical field
  // migration. Both paths are indexed and bounded to one document.
  const legacy = await getDocs(query(
    items,
    where('userId', '==', userId),
    where('unit_profile_id', '==', profileId),
    limit(1),
  ))
  return legacy.docs.length > 0
}

const allowedOverrideFields = [
  'name', 'category', 'brand', 'calories', 'protein', 'carbs', 'fat', 'fiber',
  'unitWeightG', 'portionWeightG', 'notes', 'isHidden',
] as const

export function sanitizeFoodOverrideChanges(changes: Record<string, unknown>) {
  return Object.fromEntries(allowedOverrideFields.flatMap((field) => field in changes ? [[field, changes[field]]] : []))
}

/** Pure mapper used by the aggregate query and focused unit tests. */
export const foodUsageCountsFromRecords = (records: readonly Record<string, unknown>[]) => records.reduce<Record<string, number>>((counts, record) => {
  const foodId = record.foodId
  if (typeof foodId !== 'string' || !foodId) return counts

  const count = nonNegativeCount(record.usageCount)
  if (!count) return counts

  const source = asFoodUsageSource(record.foodSource)
  const qualifiedKey = foodUsageKey(source, foodId)
  counts[qualifiedKey] = (counts[qualifiedKey] ?? 0) + count

  // Compatibility with the current list page while callers migrate to the
  // source-qualified key. The persisted aggregate never loses this distinction.
  counts[foodId] = (counts[foodId] ?? 0) + count
  return counts
}, {})

export const nutritionService = {
  async initializeUser(userId: string) {
    const database = firestore()
    const existingMeals = await getDocs(query(collection(database, 'mealTypes'), where('userId', '==', userId), limit(1)))
    if (existingMeals.empty) {
      const batch = writeBatch(database)
      createDefaultMealTypes(userId).forEach((meal) => {
        const ref = doc(database, 'mealTypes', meal.id)
        batch.set(ref, {
          userId,
          name: meal.name,
          icon: meal.icon,
          color: meal.color,
          suggestedTime: meal.suggestedTime,
          order: meal.order,
          isActive: true,
          isDefault: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      })
      await batch.commit()
    }
    const preferencesRef = doc(database, 'userPreferences', userId)
    if (!(await getDoc(preferencesRef)).exists()) await setDoc(preferencesRef, { userId, theme: 'system', createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  },

  async privateFoods(userId: string) {
    const snapshot = await getDocs(query(collection(firestore(), 'foods'), where('userId', '==', userId), orderBy('name')))
    return snapshot.docs.map((item) => toFood(item.id, item.data())).filter((food) => food.isActive !== false)
  },

  async createFood(userId: string, input: Omit<Food, 'id' | 'userId' | 'isPublic' | 'createdAt' | 'updatedAt'>) {
    const definedInput = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined))
    const ref = await addDoc(collection(firestore(), 'foods'), { ...definedInput, userId, isPublic: false, isActive: input.isActive !== false, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    return ref.id
  },

  async updatePrivateFood(userId: string, foodId: string, input: Partial<Omit<Food, 'id' | 'userId' | 'isPublic'>>) {
    const ref = doc(firestore(), 'foods', foodId)
    const current = await getDoc(ref)
    if (!current.exists() || current.data().userId !== userId) throw new Error('Você não pode alterar este alimento.')
    const normalizedInput = Object.fromEntries(Object.entries(input).map(([key, value]) => [key, value === undefined ? deleteField() : value]))
    await updateDoc(ref, { ...normalizedInput, updatedAt: serverTimestamp() })
  },

  async softDeletePrivateFood(userId: string, foodId: string) {
    await this.updatePrivateFood(userId, foodId, { isActive: false })
  },

  async foodOverrides(userId: string) {
    const snapshot = await getDocs(query(collection(firestore(), 'foodOverrides'), where('userId', '==', userId)))
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data(), createdAt: timestampToIso(item.data().createdAt), updatedAt: timestampToIso(item.data().updatedAt) }) as FoodOverride)
  },

  async saveFoodOverride(userId: string, publicFoodId: string, changes: Partial<Omit<FoodOverride, 'id' | 'userId' | 'publicFoodId' | 'createdAt' | 'updatedAt'>>) {
    const database = firestore()
    const ref = doc(database, 'foodOverrides', overrideId(userId, publicFoodId))
    await runTransaction(database, async (transaction) => {
      const existing = await transaction.get(ref)
      if (existing.exists() && existing.data().userId !== userId) throw new Error('Você não pode alterar esta personalização.')

      transaction.set(ref, {
        userId,
        publicFoodId,
        description: deleteField(),
        baseUnit: deleteField(),
        saturatedFat: deleteField(),
        sugar: deleteField(),
        sodium: deleteField(),
        source: deleteField(),
        isActive: deleteField(),
        ...sanitizeFoodOverrideChanges(changes as Record<string, unknown>),
        updatedAt: serverTimestamp(),
        ...(!existing.exists() || existing.data().createdAt === undefined
          ? { createdAt: serverTimestamp() }
          : {}),
      }, { merge: true })
    })
  },

  async restorePublicFood(userId: string, publicFoodId: string) {
    await deleteDoc(doc(firestore(), 'foodOverrides', overrideId(userId, publicFoodId)))
  },

  async setPublicFoodHidden(userId: string, publicFoodId: string, isHidden: boolean) {
    await this.saveFoodOverride(userId, publicFoodId, { isHidden })
  },

  async favorites(userId: string) {
    const snapshot = await getDocs(query(collection(firestore(), 'foodFavorites'), where('userId', '==', userId)))
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data(), createdAt: timestampToIso(item.data().createdAt) }) as FoodFavorite)
  },

  async setFavorite(userId: string, foodId: string, foodSource: 'public' | 'private', active: boolean) {
    const ref = doc(firestore(), 'foodFavorites', favoriteId(userId, foodSource, foodId))
    await runTransaction(firestore(), async (transaction) => {
      const existing = await transaction.get(ref)
      if (active && !existing.exists()) {
        transaction.set(ref, { userId, foodId, foodSource, createdAt: serverTimestamp() })
      } else if (!active && existing.exists()) {
        transaction.delete(ref)
      }
    })
  },

  async foodUnitProfiles(userId: string, foodId?: string, foodSource?: FoodSource, options: { includeInactive?: boolean } = {}) {
    try {
      failFastWhenOffline()
      const constraints: QueryConstraint[] = [where('userId', '==', userId)]
      if (foodId) constraints.push(where('foodId', '==', foodId))
      if (foodSource) constraints.push(where('foodSource', '==', foodSource))
      if (!options.includeInactive) constraints.push(where('isActive', '==', true))
      const snapshot = await getDocs(query(collection(firestore(), 'foodUnitProfiles'), ...constraints))
      const profiles = sortFoodUnitProfiles(snapshot.docs.map((item) => toFoodUnitProfile(item.id, item.data())))
      await cacheFoodUnitProfiles(profiles)
      return withProfileSyncStatus(userId, profiles)
    } catch (error) {
      if (!isOfflineFailure(error)) throw error
      const cached = await getCachedFoodUnitProfiles(userId, foodId, foodSource, Boolean(options.includeInactive))
      return withProfileSyncStatus(userId, cached)
    }
  },

  async saveFoodUnitProfile(userId: string, input: FoodUnitProfileDraft, options: SaveFoodUnitProfileOptions = {}) {
    const draft = validateFoodUnitProfileDraft(input)
    const now = new Date().toISOString()
    const profile: FoodUnitProfile = {
      id: foodUnitProfileId(userId, draft.foodSource, draft.foodId, draft.name),
      userId,
      ...draft,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'synced',
    }

    try {
      failFastWhenOffline()
      const persisted = await persistFoodUnitProfile(userId, profile, options.replacesProfileId)
      await cacheFoodUnitProfileWithDefault(persisted)
      if (options.replacesProfileId && options.replacesProfileId !== persisted.id) {
        const former = await getCachedFoodUnitProfile(options.replacesProfileId)
        if (former) await cacheFoodUnitProfile({ ...former, isActive: false, isDefault: false, updatedAt: now })
      }
      return persisted
    } catch (error) {
      if (!isOfflineFailure(error) || options.queueIfOffline === false) throw error
      const pending: FoodUnitProfile = { ...profile, syncStatus: 'pending' }
      await cacheFoodUnitProfileWithDefault(pending)
      if (options.replacesProfileId && options.replacesProfileId !== pending.id) {
        const former = await getCachedFoodUnitProfile(options.replacesProfileId)
        if (former) await cacheFoodUnitProfile({ ...former, isActive: false, isDefault: false, updatedAt: now, syncStatus: 'pending' })
      }
      await enqueueFoodUnitProfileOperation({ kind: 'upsert', userId, profile: pending })
      return pending
    }
  },

  async setDefaultFoodUnitProfile(userId: string, profileId: string, options: { queueIfOffline?: boolean } = {}) {
    try {
      failFastWhenOffline()
      const database = firestore()
      const ref = doc(database, 'foodUnitProfiles', profileId)
      const candidate = await getDoc(ref)
      if (!candidate.exists() || candidate.data().userId !== userId) throw new Error('Você não pode alterar esta unidade.')
      const candidateProfile = toFoodUnitProfile(candidate.id, candidate.data())
      if (!candidateProfile.isActive) throw new Error('Não é possível definir uma unidade desativada como padrão.')
      const peerRefs = (await getDocs(query(
        collection(database, 'foodUnitProfiles'),
        where('userId', '==', userId),
        where('foodId', '==', candidateProfile.foodId),
        where('foodSource', '==', candidateProfile.foodSource),
      ))).docs.map((item) => item.ref)
      let selected: FoodUnitProfile | null = null
      await runTransaction(database, async (transaction) => {
        const [current, ...profiles] = await Promise.all([
          transaction.get(ref),
          ...peerRefs.map((profileRef) => transaction.get(profileRef)),
        ])
        if (!current.exists() || current.data().userId !== userId) throw new Error('Você não pode alterar esta unidade.')
        const profile = toFoodUnitProfile(current.id, current.data())
        if (!profile.isActive) throw new Error('Não é possível definir uma unidade desativada como padrão.')
        if (profile.foodId !== candidateProfile.foodId || profile.foodSource !== candidateProfile.foodSource) {
          throw new Error('A unidade mudou de alimento durante a operação. Tente novamente.')
        }
        profiles.forEach((peer) => {
          if (peer.exists()
            && peer.id !== profileId
            && peer.data().isDefault === true) {
            transaction.update(peer.ref, { isDefault: false, updatedAt: serverTimestamp() })
          }
        })
        transaction.update(ref, { isDefault: true, updatedAt: serverTimestamp() })
        selected = { ...profile, isDefault: true, updatedAt: new Date().toISOString(), syncStatus: 'synced' }
      })
      if (!selected) throw new Error('Não foi possível definir a unidade padrão.')
      await cacheFoodUnitProfileWithDefault(selected)
      return selected
    } catch (error) {
      if (!isOfflineFailure(error) || options.queueIfOffline === false) throw error
      const cached = await profileFromCache(profileId)
      if (!cached || cached.userId !== userId) throw new Error('A unidade não está disponível neste dispositivo para ser definida como padrão.')
      if (!cached.isActive) throw new Error('Não é possível definir uma unidade desativada como padrão.')
      const pending: FoodUnitProfile = { ...cached, isDefault: true, updatedAt: new Date().toISOString(), syncStatus: 'pending' }
      await cacheFoodUnitProfileWithDefault(pending)
      await enqueueFoodUnitProfileOperation({ kind: 'upsert', userId, profile: pending })
      return pending
    }
  },

  async deactivateFoodUnitProfile(userId: string, profileId: string, options: { queueIfOffline?: boolean } = {}) {
    try {
      failFastWhenOffline()
      const profile = await persistFoodUnitProfileState(userId, profileId, false)
      await cacheFoodUnitProfile(profile)
      return profile
    } catch (error) {
      if (!isOfflineFailure(error) || options.queueIfOffline === false) throw error
      const cached = await profileFromCache(profileId)
      if (!cached || cached.userId !== userId) throw new Error('A unidade não está disponível neste dispositivo.')
      const pending: FoodUnitProfile = { ...cached, isActive: false, isDefault: false, updatedAt: new Date().toISOString(), syncStatus: 'pending' }
      await cacheFoodUnitProfile(pending)
      await enqueueFoodUnitProfileOperation({ kind: 'upsert', userId, profile: pending })
      return pending
    }
  },

  async restoreFoodUnitProfile(userId: string, profileId: string, options: { queueIfOffline?: boolean } = {}) {
    try {
      failFastWhenOffline()
      const profile = await persistFoodUnitProfileState(userId, profileId, true)
      await cacheFoodUnitProfile(profile)
      return profile
    } catch (error) {
      if (!isOfflineFailure(error) || options.queueIfOffline === false) throw error
      const cached = await profileFromCache(profileId)
      if (!cached || cached.userId !== userId) throw new Error('A unidade não está disponível neste dispositivo.')
      const pending: FoodUnitProfile = { ...cached, isActive: true, isDefault: false, updatedAt: new Date().toISOString(), syncStatus: 'pending' }
      await cacheFoodUnitProfile(pending)
      await enqueueFoodUnitProfileOperation({ kind: 'upsert', userId, profile: pending })
      return pending
    }
  },

  async deleteFoodUnitProfile(userId: string, profileId: string, hardDeleteIfUnused = false): Promise<DeleteFoodUnitProfileResult> {
    try {
      failFastWhenOffline()
      const ref = doc(firestore(), 'foodUnitProfiles', profileId)
      const current = await getDoc(ref)
      if (!current.exists() || current.data().userId !== userId) throw new Error('Você não pode excluir esta unidade.')
      const usedInDiary = await foodUnitProfileHasSnapshots(userId, profileId)
      if (usedInDiary || !hardDeleteIfUnused) {
        const profile = await persistFoodUnitProfileState(userId, profileId, false)
        await cacheFoodUnitProfile(profile)
        return 'deactivated'
      }
      await deleteDoc(ref)
      await removeCachedFoodUnitProfile(profileId)
      return 'deleted'
    } catch (error) {
      if (!isOfflineFailure(error)) throw error
      // Offline deletion is deliberately conservative: no usage query is
      // trusted without the server, so it becomes a reversible soft delete.
      const cached = await profileFromCache(profileId)
      if (!cached || cached.userId !== userId) throw new Error('A unidade não está disponível neste dispositivo.')
      const pending: FoodUnitProfile = { ...cached, isActive: false, isDefault: false, updatedAt: new Date().toISOString(), syncStatus: 'pending' }
      await cacheFoodUnitProfile(pending)
      await enqueueFoodUnitProfileOperation({ kind: 'upsert', userId, profile: pending })
      return 'deactivated'
    }
  },

  async foodDensityProfile(userId: string, foodId: string, foodSource: FoodSource) {
    const profileId = foodDensityProfileId(userId, foodSource, foodId)
    try {
      failFastWhenOffline()
      const snapshot = await getDoc(doc(firestore(), 'foodDensityProfiles', profileId))
      if (!snapshot.exists()) {
        await removeCachedFoodDensityProfile(profileId)
        return null
      }
      if (snapshot.data().userId !== userId) throw new Error('Você não pode acessar esta densidade.')
      const profile = toFoodDensityProfile(snapshot.id, snapshot.data())
      await cacheFoodDensityProfile(profile)
      return withDensitySyncStatus(userId, profile)
    } catch (error) {
      if (!isOfflineFailure(error)) throw error
      return withDensitySyncStatus(userId, await getCachedFoodDensityProfile(profileId) ?? null)
    }
  },

  async saveFoodDensityProfile(userId: string, input: FoodDensityProfileDraft, options: { queueIfOffline?: boolean } = {}) {
    const draft = validateFoodDensityProfileDraft(input)
    const now = new Date().toISOString()
    const profile: FoodDensityProfile = {
      id: foodDensityProfileId(userId, draft.foodSource, draft.foodId),
      userId,
      ...draft,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'synced',
    }
    try {
      failFastWhenOffline()
      const persisted = await persistFoodDensityProfile(userId, profile)
      await cacheFoodDensityProfile(persisted)
      return persisted
    } catch (error) {
      if (!isOfflineFailure(error) || options.queueIfOffline === false) throw error
      const pending: FoodDensityProfile = { ...profile, syncStatus: 'pending' }
      await cacheFoodDensityProfile(pending)
      await enqueueFoodDensityProfileOperation({ kind: 'upsert', userId, profile: pending })
      return pending
    }
  },

  async deleteFoodDensityProfile(userId: string, foodId: string, foodSource: FoodSource) {
    const profileId = foodDensityProfileId(userId, foodSource, foodId)
    try {
      failFastWhenOffline()
      const ref = doc(firestore(), 'foodDensityProfiles', profileId)
      const current = await getDoc(ref)
      if (!current.exists() || current.data().userId !== userId) throw new Error('Você não pode excluir esta densidade.')
      await deleteDoc(ref)
      await removeCachedFoodDensityProfile(profileId)
    } catch (error) {
      if (!isOfflineFailure(error)) throw error
      await removeCachedFoodDensityProfile(profileId)
      await enqueueFoodDensityProfileOperation({ kind: 'delete', userId, profileId })
    }
  },

  /** Explicit hook for an online listener; it never runs automatically or for another user. */
  async syncFoodUnitProfiles(userId: string) {
    return syncFoodUnitProfileOperations(userId, async (operation) => {
      if (operation.kind === 'upsert') {
        const profile = await persistFoodUnitProfile(userId, { ...operation.profile, syncStatus: 'synced' })
        await cacheFoodUnitProfileWithDefault(profile)
        return
      }
      const ref = doc(firestore(), 'foodUnitProfiles', operation.profileId)
      const current = await getDoc(ref)
      if (!current.exists()) return
      if (current.data().userId !== userId) throw new Error('Você não pode excluir esta unidade.')
      if (await foodUnitProfileHasSnapshots(userId, operation.profileId)) {
        await persistFoodUnitProfileState(userId, operation.profileId, false)
      } else {
        await deleteDoc(ref)
        await removeCachedFoodUnitProfile(operation.profileId)
      }
    })
  },

  /** Explicit hook for queued density profiles. The newest deterministic operation wins. */
  async syncFoodDensityProfiles(userId: string) {
    return syncFoodDensityProfileOperations(userId, async (operation) => {
      if (operation.kind === 'upsert') {
        const profile = await persistFoodDensityProfile(userId, { ...operation.profile, syncStatus: 'synced' })
        await cacheFoodDensityProfile(profile)
        return
      }
      const ref = doc(firestore(), 'foodDensityProfiles', operation.profileId)
      const current = await getDoc(ref)
      if (!current.exists()) return
      if (current.data().userId !== userId) throw new Error('Você não pode excluir esta densidade.')
      await deleteDoc(ref)
      await removeCachedFoodDensityProfile(operation.profileId)
    })
  },

  async mealTypes(userId: string) {
    await this.initializeUser(userId)
    const snapshot = await getDocs(query(collection(firestore(), 'mealTypes'), where('userId', '==', userId), orderBy('order')))
    return snapshot.docs.map((item) => toMealType(item.id, item.data())).filter((meal) => !meal.deletedAt)
  },

  async createMealType(userId: string, input: Omit<MealType, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'deletedAt'>) {
    const ref = await addDoc(collection(firestore(), 'mealTypes'), { ...input, userId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    return ref.id
  },

  async updateMealType(userId: string, mealTypeId: string, input: Partial<Omit<MealType, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>) {
    const ref = doc(firestore(), 'mealTypes', mealTypeId)
    const current = await getDoc(ref)
    if (!current.exists() || current.data().userId !== userId) throw new Error('Você não pode alterar esta refeição.')
    await updateDoc(ref, { ...input, updatedAt: serverTimestamp() })
  },

  async softDeleteMealType(userId: string, mealTypeId: string) {
    await this.updateMealType(userId, mealTypeId, { isActive: false, deletedAt: new Date().toISOString() })
  },

  async reorderMealTypes(userId: string, orderedIds: string[]) {
    const database = firestore()
    const current = await Promise.all(orderedIds.map((id) => getDoc(doc(database, 'mealTypes', id))))
    if (current.some((item) => !item.exists() || item.data().userId !== userId)) throw new Error('Voc\u00ea n\u00e3o pode reordenar estas refei\u00e7\u00f5es.')
    const batch = writeBatch(database)
    orderedIds.forEach((id, index) => batch.update(doc(database, 'mealTypes', id), { order: index, updatedAt: serverTimestamp() }))
    await batch.commit()
  },

  async goals(userId: string): Promise<Goal | null> {
    const database = firestore()
    const snapshot = await getDocs(query(collection(database, 'goals'), where('userId', '==', userId), limit(10)))
    const canonical = snapshot.docs.find((item) => item.id === userId)
    const data = canonical?.data() ?? snapshot.docs[0]?.data()
    if (!data) return null
    return {
      calories: toNumber(data.calories),
      protein: toNumber(data.protein),
      carbs: toNumber(data.carbs),
      fat: toNumber(data.fat),
      fiber: toNumber(data.fiber),
      waterMl: toNumber(data.waterMl ?? data.water_ml),
      weightGoalKg: data.weightGoalKg ?? data.weight_goal_kg
        ? toNumber(data.weightGoalKg ?? data.weight_goal_kg)
        : null,
    }
  },

  async dayItems(userId: string, date: string) {
    const snapshot = await getDocs(query(collection(firestore(), 'mealItems'), where('userId', '==', userId), where('date', '==', date)))
    return snapshot.docs.map((item) => toMealItem(item.id, item.data()))
  },

  async foodUsageCounts(userId: string) {
    const snapshot = await getDocs(query(collection(firestore(), 'foodUsage'), where('userId', '==', userId)))
    return foodUsageCountsFromRecords(snapshot.docs.map((item) => item.data()))
  },

  async addMealItem(
    userId: string,
    date: string,
    mealType: MealType,
    food: Food,
    quantity: number,
    unit: Unit,
    selection: MealItemUnitSelection = {},
  ) {
    if (selection.unitProfile && isPersistedFoodUnitProfile(selection.unitProfile) && selection.unitProfile.userId !== userId) {
      throw new Error('Você não pode usar uma unidade cadastrada por outra pessoa.')
    }
    if (selection.densityProfile && selection.densityProfile.userId !== userId) {
      throw new Error('Você não pode usar uma densidade cadastrada por outra pessoa.')
    }
    const resolvedUnit = resolveMealItemUnitSelection(food, quantity, unit, selection)
    const factor = resolvedUnit.nutrientBaseAmount / 100
    const nutrients = {
      calories: food.calories * factor,
      protein: food.protein * factor,
      carbs: food.carbs * factor,
      fat: food.fat * factor,
      fiber: food.fiber * factor,
      saturatedFat: (food.saturatedFat ?? 0) * factor,
      sugar: (food.sugar ?? 0) * factor,
      sodium: (food.sodium ?? 0) * factor,
    }
    const database = firestore()
    const foodSource: FoodUsageSource = food.isPublic ? 'public' : 'private'
    const mealItemRef = doc(collection(database, 'mealItems'))
    const usageRef = doc(database, 'foodUsage', foodUsageDocumentId(userId, foodSource, food.id))

    await runTransaction(database, async (transaction) => {
      const usage = await transaction.get(usageRef)
      const usageCount = usage.exists() ? nonNegativeCount(usage.data().usageCount) : 0
      const now = serverTimestamp()

      transaction.set(mealItemRef, {
        userId,
        date,
        mealTypeId: mealType.id,
        mealNameSnapshot: mealType.name,
        mealIconSnapshot: mealType.icon,
        foodId: food.id,
        foodSource,
        foodNameSnapshot: food.name,
        calories: nutrients.calories,
        protein: nutrients.protein,
        carbs: nutrients.carbs,
        fat: nutrients.fat,
        fiber: nutrients.fiber,
        saturatedFat: nutrients.saturatedFat ?? 0,
        sugar: nutrients.sugar ?? 0,
        sodium: nutrients.sodium ?? 0,
        unitWeightGSnapshot: food.unitWeightG ?? null,
        quantity,
        unit,
        unitProfileId: resolvedUnit.unitProfileId ?? null,
        unitLabelSnapshot: resolvedUnit.unitLabelSnapshot ?? null,
        amountPerUnitSnapshot: resolvedUnit.amountPerUnitSnapshot ?? null,
        baseMeasureSnapshot: resolvedUnit.baseMeasureSnapshot ?? null,
        consumedBaseAmount: resolvedUnit.consumedBaseAmount ?? null,
        nutrientBaseAmount: resolvedUnit.nutrientBaseAmount,
        // Kept for legacy screens and documents. For ml-based foods this is a
        // numeric base amount, not an implicit mass conversion.
        consumedGrams: resolvedUnit.nutrientBaseAmount,
        usageAggregated: true,
        createdAt: now,
        updatedAt: now,
      })
      transaction.set(usageRef, {
        userId,
        foodId: food.id,
        foodSource,
        usageCount: usageCount + 1,
        lastUsedAt: now,
        updatedAt: now,
        ...(!usage.exists() || usage.data().createdAt === undefined
          ? { createdAt: now }
          : {}),
      }, { merge: true })
    })

    return mealItemRef.id
  },

  async addWater(userId: string, amountMl: number, date = localIsoDate()) {
    if (!Number.isFinite(amountMl) || amountMl <= 0 || amountMl > 20_000) throw new Error('Informe uma quantidade de água entre 0 e 20.000 ml.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Informe uma data válida para a hidratação.')
    const now = serverTimestamp()
    await addDoc(collection(firestore(), 'waterLogs'), { userId, date, amountMl, loggedAt: now, createdAt: now, updatedAt: now })
  },

  async water(userId: string, date: string) {
    const snapshot = await getDocs(query(collection(firestore(), 'waterLogs'), where('userId', '==', userId), where('date', '==', date)))
    return snapshot.docs.map((item) => ({ id: item.id, amountMl: toNumber(item.data().amountMl ?? item.data().amount_ml), loggedAt: timestampToIso(item.data().loggedAt ?? item.data().logged_at) ?? '' }))
  },

  async deleteWater(userId: string, waterId: string) {
    const ref = doc(firestore(), 'waterLogs', waterId)
    const current = await getDoc(ref)
    if (!current.exists() || current.data().userId !== userId) throw new Error('Você não pode excluir este registro de hidratação.')
    await deleteDoc(ref)
  },

  async deleteMealItem(userId: string, mealItemId: string) {
    const database = firestore()
    const ref = doc(database, 'mealItems', mealItemId)
    await runTransaction(database, async (transaction) => {
      const current = await transaction.get(ref)
      if (!current.exists() || current.data().userId !== userId) throw new Error('Você não pode excluir este lançamento.')

      const data = current.data()
      const foodId = data.foodId ?? data.food_id
      const foodSource = asFoodUsageSource(data.foodSource)
      const usageRef = typeof foodId === 'string' && foodId
        ? doc(database, 'foodUsage', foodUsageDocumentId(userId, foodSource, foodId))
        : null
      const usage = usageRef ? await transaction.get(usageRef) : null

      transaction.delete(ref)
      if (usageRef && usage?.exists()) {
        transaction.update(usageRef, {
          usageCount: Math.max(0, nonNegativeCount(usage.data().usageCount) - 1),
          updatedAt: serverTimestamp(),
        })
      }
    })
  },

  async preferences(userId: string): Promise<UserPreferences | null> {
    const snapshot = await getDoc(doc(firestore(), 'userPreferences', userId))
    if (!snapshot.exists()) return null
    const data = snapshot.data()
    return { id: snapshot.id, userId, theme: data.theme as ThemePreference, createdAt: timestampToIso(data.createdAt), updatedAt: timestampToIso(data.updatedAt) }
  },

  async setTheme(userId: string, theme: ThemePreference) {
    const database = firestore()
    const ref = doc(database, 'userPreferences', userId)
    await runTransaction(database, async (transaction) => {
      const existing = await transaction.get(ref)
      if (existing.exists() && existing.data().userId !== userId) throw new Error('Você não pode alterar esta preferência.')
      transaction.set(ref, {
        userId,
        theme,
        updatedAt: serverTimestamp(),
        ...(!existing.exists() || existing.data().createdAt === undefined
          ? { createdAt: serverTimestamp() }
          : {}),
      }, { merge: true })
    })
  },
}
