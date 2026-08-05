export type Unit = 'g' | 'kg' | 'ml' | 'l' | 'unidade' | 'porção'
export type BaseUnit = 'g' | 'ml'
export type FoodSource = 'public' | 'private'
export type FoodUnitMeasureType = 'mass' | 'volume'
export type FoodUnitProfileOrigin = 'catalog' | 'user'
export type FoodDensitySource = 'label' | 'user' | 'professional'
export type CatalogMeasurementPolicy = 'mass-source' | 'volume-source' | 'requires-density'
export type SyncStatus = 'synced' | 'pending'
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
  catalogOrigin?: 'curated-br' | 'taco'
  measurementPolicy?: CatalogMeasurementPolicy
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

/**
 * A user-owned household measure for one food. Timestamps are normalized to
 * ISO strings when Firestore documents are read by the application.
 */
export type FoodUnitProfile = {
  id: string
  userId: string
  foodId: string
  foodSource: FoodSource
  name: string
  singularLabel: string
  pluralLabel?: string | null
  measureType: FoodUnitMeasureType
  baseMeasure: BaseUnit
  amountPerUnit: number
  isDefault: boolean
  isActive: boolean
  origin: FoodUnitProfileOrigin
  notes?: string | null
  createdAt?: string
  updatedAt?: string
  /** Local-only state used while a deterministic offline mutation is queued. */
  syncStatus?: SyncStatus
}

/**
 * A catalogue weight is presented exactly like a selectable unit, but is
 * intentionally virtual: accepting it must not create a Firestore document.
 */
export type CatalogUnitSuggestion = Omit<FoodUnitProfile, 'userId' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'origin'> & {
  origin: 'catalog'
  isPersisted: false
}

export type FoodUnitChoice = FoodUnitProfile | CatalogUnitSuggestion

export type FoodUnitProfileDraft = {
  foodId: string
  foodSource: FoodSource
  name: string
  singularLabel: string
  pluralLabel?: string | null
  measureType: FoodUnitMeasureType
  baseMeasure: BaseUnit
  /** Form values may use the Brazilian decimal separator and are normalized before persistence. */
  amountPerUnit: number | string
  isDefault?: boolean
  isActive?: boolean
  origin?: FoodUnitProfileOrigin
  notes?: string | null
}

/** A one-off measure has the same validation as a saved profile, but is never persisted. */
export type TemporaryFoodUnit = {
  name?: string | null
  singularLabel?: string | null
  amountPerUnit: number | string
  baseMeasure: BaseUnit
}

export type FoodDensityProfile = {
  id: string
  userId: string
  foodId: string
  foodSource: FoodSource
  gramsPerMl: number
  source: FoodDensitySource
  notes?: string | null
  createdAt?: string
  updatedAt?: string
  syncStatus?: SyncStatus
}

export type FoodDensityProfileDraft = {
  foodId: string
  foodSource: FoodSource
  gramsPerMl: number | string
  source: FoodDensitySource
  notes?: string | null
}

/**
 * Saved with a meal item so later edits to a profile never alter historical
 * nutrients or the label originally chosen by the user.
 */
export type MealItemUnitSnapshot = {
  unitProfileId?: string | null
  unitLabelSnapshot?: string | null
  amountPerUnitSnapshot?: number | null
  baseMeasureSnapshot?: BaseUnit | null
  consumedBaseAmount?: number | null
  nutrientBaseAmount?: number | null
}

export type MealItemUnitSelection = {
  unitProfile?: FoodUnitChoice | null
  temporaryUnit?: TemporaryFoodUnit | null
  densityProfile?: FoodDensityProfile | null
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

export type MealItem = Nutrients & MealItemUnitSnapshot & {
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
  updatedAt?: string
}

export type Goal = {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  waterMl: number
  /** Optional body-weight target, kept with the other user goals. */
  weightGoalKg?: number | null
}

/**
 * The canonical wording used by onboarding, profile and evolution. Keeping it
 * in one type prevents a profile from being labelled differently in each
 * screen.
 */
export type UserGoal = 'Emagrecimento' | 'Manutenção' | 'Ganho de peso' | 'Saúde e bem-estar'

export type UserProfile = {
  id: string
  userId: string
  name?: string | null
  displayName?: string | null
  email?: string | null
  birthDate?: string | null
  heightCm?: number | null
  goal?: UserGoal | null
  onboardingCompleted?: boolean
  onboardingCompletedAt?: string
  createdAt?: string
  updatedAt?: string
}

export type WeightLogSource = 'onboarding' | 'profile' | 'evolution' | 'assessment' | 'measurement'

export type WeightLog = {
  id: string
  userId: string
  date: string
  weightKg: number
  source: WeightLogSource
  time?: string | null
  notes?: string | null
  fasted?: boolean | null
  createdAt?: string
  updatedAt?: string
}

export type BodyMeasurement = {
  id: string
  userId: string
  date: string
  weightKg?: number | null
  neckCm?: number | null
  shouldersCm?: number | null
  chestCm?: number | null
  waistCm?: number | null
  abdomenCm?: number | null
  hipCm?: number | null
  leftArmRelaxedCm?: number | null
  rightArmRelaxedCm?: number | null
  leftArmContractedCm?: number | null
  rightArmContractedCm?: number | null
  leftForearmCm?: number | null
  rightForearmCm?: number | null
  leftThighCm?: number | null
  rightThighCm?: number | null
  leftCalfCm?: number | null
  rightCalfCm?: number | null
  notes?: string | null
  createdAt?: string
  updatedAt?: string
}

export type BiologicalSex = 'female' | 'male'

export type BodyFatMethod =
  | 'manual'
  | 'bioimpedance'
  | 'navy'
  | 'jackson-pollock-3'
  | 'jackson-pollock-7'
  | 'durnin-womersley'
  | 'faulkner'
  | 'guedes'
  | 'other'

export type PhysicalAssessment = {
  id: string
  userId: string
  evaluatorName?: string | null
  evaluatorRegistration?: string | null
  assessmentDate: string
  weightKg: number
  heightCm: number
  bodyFatMethod: BodyFatMethod
  /** Required by formula-based protocols; omitted for reported measurements. */
  biologicalSex?: BiologicalSex | null
  /** Snapshot of age used by protocols that require it. */
  ageYears?: number | null
  reportedBodyFatPercent?: number | null
  calculatedBodyFatPercent?: number | null
  fatMassKg?: number | null
  leanMassKg?: number | null
  muscleMassKg?: number | null
  boneMassKg?: number | null
  bodyWaterPercent?: number | null
  visceralFatLevel?: number | null
  metabolicAge?: number | null
  basalMetabolicRateKcal?: number | null
  bmi?: number | null
  waistHipRatio?: number | null
  waistHeightRatio?: number | null
  neckCm?: number | null
  chestCm?: number | null
  waistCm?: number | null
  abdomenCm?: number | null
  hipCm?: number | null
  tricepsSkinfoldMm?: number | null
  bicepsSkinfoldMm?: number | null
  subscapularSkinfoldMm?: number | null
  suprailiacSkinfoldMm?: number | null
  abdominalSkinfoldMm?: number | null
  chestSkinfoldMm?: number | null
  midaxillarySkinfoldMm?: number | null
  thighSkinfoldMm?: number | null
  calfSkinfoldMm?: number | null
  restingHeartRate?: number | null
  systolicBloodPressure?: number | null
  diastolicBloodPressure?: number | null
  goals?: string | null
  observations?: string | null
  recommendations?: string | null
  createdAt?: string
  updatedAt?: string
}

export type UserPreferences = {
  id: string
  userId: string
  theme: ThemePreference
  createdAt?: string
  updatedAt?: string
}
