export type Unit = 'g' | 'kg' | 'ml' | 'l' | 'unidade' | 'porção'
export type BaseUnit = 'g' | 'ml'
export type FoodSource = 'public' | 'private'
export type ThemePreference = 'light' | 'dark' | 'system'

export type Nutrients = {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  saturatedFat?: number
  sugar?: number
  sodium?: number
}

export type Food = Nutrients & {
  id: string
  name: string
  brand?: string | null
  description?: string | null
  category?: string | null
  baseUnit: BaseUnit
  unitWeightG?: number | null
  portionWeightG?: number | null
  source?: string | null
  notes?: string | null
  isFavorite?: boolean
  isActive?: boolean
  isPublic?: boolean
  userId?: string
  externalId?: string
  createdAt?: string
  updatedAt?: string
}

export type PublicFood = Nutrients & {
  externalId: string
  name: string
  nameNormalized: string
  searchKeywords: string[]
  category?: string | null
  brand?: string | null
  baseUnit: BaseUnit
  source?: string | null
  language?: string | null
  isActive: boolean
}

export type FoodOverride = Partial<Omit<Food, 'id' | 'userId' | 'externalId' | 'isPublic'>> & {
  id: string
  userId: string
  publicFoodId: string
  isHidden?: boolean
  createdAt?: string
  updatedAt?: string
}

export type FoodFavorite = {
  id: string
  userId: string
  foodId: string
  foodSource: FoodSource
  createdAt?: string
}

export type FoodSearchFilters = {
  query: string
  category?: string
  favoritesOnly?: boolean
  showHidden?: boolean
  source?: FoodSource | 'all'
}

export type MealType = {
  id: string
  userId: string
  name: string
  icon: string
  color?: string | null
  suggestedTime?: string | null
  order: number
  isActive: boolean
  isDefault: boolean
  deletedAt?: string | null
  createdAt?: string
  updatedAt?: string
}

export type MealItem = Nutrients & {
  id: string
  userId: string
  date: string
  mealTypeId?: string | null
  mealNameSnapshot?: string
  mealIconSnapshot?: string
  mealName?: string
  foodId?: string
  foodSource?: FoodSource
  foodNameSnapshot: string
  unitWeightGSnapshot?: number | null
  quantity: number
  unit: Unit
  consumedGrams: number
  createdAt?: string
}

export type Goal = {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  waterMl: number
}

export type UserPreferences = {
  id: string
  userId: string
  theme: ThemePreference
  createdAt?: string
  updatedAt?: string
}
