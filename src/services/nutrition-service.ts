import {
  addDoc,
  collection,
  deleteDoc,
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
} from 'firebase/firestore'
import { availableFoodUnits, calculateNutrients } from '../lib/nutrition'
import { localIsoDate } from '../lib/dates'
import { createDefaultMealTypes, resolveMealIconKey } from '../lib/meal-types'
import type { Food, FoodFavorite, FoodOverride, Goal, MealItem, MealType, ThemePreference, Unit, UserPreferences } from '../lib/types'
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
  createdAt: timestampToIso(data.createdAt ?? data.created_at),
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
    const ref = await addDoc(collection(firestore(), 'foods'), { ...input, userId, isPublic: false, isActive: input.isActive !== false, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    return ref.id
  },

  async updatePrivateFood(userId: string, foodId: string, input: Partial<Omit<Food, 'id' | 'userId' | 'isPublic'>>) {
    const ref = doc(firestore(), 'foods', foodId)
    const current = await getDoc(ref)
    if (!current.exists() || current.data().userId !== userId) throw new Error('Você não pode alterar este alimento.')
    await updateDoc(ref, { ...input, updatedAt: serverTimestamp() })
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
        ...changes,
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
    if (active) await setDoc(ref, { userId, foodId, foodSource, createdAt: serverTimestamp() })
    else await deleteDoc(ref)
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

  async addMealItem(userId: string, date: string, mealType: MealType, food: Food, quantity: number, unit: Unit) {
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Informe uma quantidade maior que zero.')
    if (unit === 'unidade' && !(Number(food.unitWeightG) > 0)) throw new Error('Este alimento não possui peso médio por unidade.')
    if (unit === 'porção' && !(Number(food.portionWeightG) > 0)) throw new Error('Este alimento não possui peso por porção.')
    if (!availableFoodUnits(food).includes(unit)) {
      throw new Error(`A unidade ${unit} não é compatível com a base ${food.baseUnit} deste alimento.`)
    }
    const nutrients = calculateNutrients(food, quantity, unit)
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
        consumedGrams: nutrients.grams,
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
    if (!Number.isFinite(amountMl) || amountMl <= 0) throw new Error('Informe uma quantidade de água maior que zero.')
    const now = new Date()
    await addDoc(collection(firestore(), 'waterLogs'), { userId, date, amountMl, amount_ml: amountMl, loggedAt: now.toISOString(), logged_at: now.toISOString(), createdAt: serverTimestamp() })
  },

  async water(userId: string, date: string) {
    const snapshot = await getDocs(query(collection(firestore(), 'waterLogs'), where('userId', '==', userId), where('date', '==', date)))
    return snapshot.docs.map((item) => ({ id: item.id, amountMl: toNumber(item.data().amountMl ?? item.data().amount_ml), loggedAt: String(item.data().loggedAt ?? item.data().logged_at ?? '') }))
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
