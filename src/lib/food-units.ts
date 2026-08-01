import type {
  BaseUnit,
  CatalogUnitSuggestion,
  Food,
  FoodDensityProfile,
  FoodDensityProfileDraft,
  FoodSource,
  FoodUnitChoice,
  FoodUnitProfile,
  FoodUnitProfileDraft,
  MealItemUnitSelection,
  MealItemUnitSnapshot,
  TemporaryFoodUnit,
  Unit,
} from './types'

export const FOOD_UNIT_MIN_AMOUNT = 0.1
export const FOOD_UNIT_MAX_AMOUNT = 10_000
export const FOOD_DENSITY_MAX_GRAMS_PER_ML = 10_000

type NormalizedFoodUnitProfileDraft = Omit<FoodUnitProfile, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'syncStatus'>
type NormalizedFoodDensityProfileDraft = Omit<FoodDensityProfile, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'syncStatus'>

export type ResolvedMealItemUnit = MealItemUnitSnapshot & {
  /** Amount used against the food's nutritional base (100 g or 100 ml). */
  nutrientBaseAmount: number
  nutrientBaseMeasure: BaseUnit
}

const FOOD_SOURCES: readonly FoodSource[] = ['public', 'private']
const BASE_MEASURES: readonly BaseUnit[] = ['g', 'ml']

const normalizeWhitespace = (value: string) => value.trim().replace(/\s+/g, ' ')

const normalizedText = (value: string) => normalizeWhitespace(value)
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .toLocaleLowerCase('pt-BR')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()

/** Accent, punctuation and case insensitive key used in deterministic document ids. */
export const normalizeUnitProfileName = (value: string) => normalizedText(value).replace(/\s+/g, '-')

const requiredText = (value: unknown, field: string, maxLength: number) => {
  if (typeof value !== 'string') throw new Error(`Informe ${field}.`)
  const normalized = normalizeWhitespace(value)
  if (!normalized) throw new Error(`Informe ${field}.`)
  if (normalized.length > maxLength) throw new Error(`${field} deve ter no máximo ${maxLength} caracteres.`)
  return normalized
}

const optionalText = (value: unknown, field: string, maxLength: number) => {
  if (value == null || value === '') return null
  return requiredText(value, field, maxLength)
}

const assertFoodSource = (value: unknown): FoodSource => {
  if (typeof value !== 'string' || !FOOD_SOURCES.includes(value as FoodSource)) throw new Error('Informe uma origem de alimento válida.')
  return value as FoodSource
}

const assertBaseMeasure = (value: unknown): BaseUnit => {
  if (typeof value !== 'string' || !BASE_MEASURES.includes(value as BaseUnit)) throw new Error('A medida-base deve ser g ou ml.')
  return value as BaseUnit
}

// Density ids may be internal implementation details, so their parts remain
// encoded. Household-measure ids below intentionally follow the public tuple.
const safeIdPart = (value: string) => encodeURIComponent(value).replace(/_/g, '%5F')

/**
 * The id is stable and follows the public user/source/food/unit tuple.
 */
export const foodUnitProfileId = (userId: string, foodSource: FoodSource, foodId: string, unitName: string) => {
  const owner = requiredText(userId, 'o usuário', 1_000)
  const source = assertFoodSource(foodSource)
  const food = requiredText(foodId, 'o alimento', 1_000)
  const unit = normalizeUnitProfileName(requiredText(unitName, 'o nome da unidade', 120))
  if (!unit) throw new Error('Informe o nome da unidade.')
  if (owner.includes('/') || food.includes('/')) throw new Error('O identificador do usuário ou do alimento não pode conter "/".')
  return `${owner}_${source}_${food}_${unit}`
}

/** One density profile per user-qualified food prevents ambiguous conversions. */
export const foodDensityProfileId = (userId: string, foodSource: FoodSource, foodId: string) => {
  const owner = requiredText(userId, 'o usuário', 1_000)
  const source = assertFoodSource(foodSource)
  const food = requiredText(foodId, 'o alimento', 1_000)
  return `density_${safeIdPart(owner)}_${source}_${safeIdPart(food)}`
}

/** Accepts both Brazilian and dot decimal input while rejecting mixed/thousands formats. */
export const parseUnitAmount = (value: number | string, baseMeasure: BaseUnit, label = 'quantidade') => {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^[+-]?\d+(?:[,.]\d+)?$/.test(value.trim())
      ? Number(value.trim().replace(',', '.'))
      : Number.NaN

  if (!Number.isFinite(parsed)) throw new Error(`Informe ${label} em ${baseMeasure} com um número válido.`)
  if (parsed < FOOD_UNIT_MIN_AMOUNT || parsed > FOOD_UNIT_MAX_AMOUNT) {
    throw new Error(`${label[0]?.toLocaleUpperCase('pt-BR')}${label.slice(1)} deve ficar entre ${FOOD_UNIT_MIN_AMOUNT} e ${FOOD_UNIT_MAX_AMOUNT} ${baseMeasure}.`)
  }
  return parsed
}

export const parseFoodDensity = (value: number | string) => {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^[+-]?\d+(?:[,.]\d+)?$/.test(value.trim())
      ? Number(value.trim().replace(',', '.'))
      : Number.NaN
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > FOOD_DENSITY_MAX_GRAMS_PER_ML) {
    throw new Error(`A densidade deve ser maior que zero e no máximo ${FOOD_DENSITY_MAX_GRAMS_PER_ML} g/ml.`)
  }
  return parsed
}

export const validateFoodUnitProfileDraft = (input: FoodUnitProfileDraft): NormalizedFoodUnitProfileDraft => {
  const foodId = requiredText(input.foodId, 'o alimento', 1_000)
  const foodSource = assertFoodSource(input.foodSource)
  const name = requiredText(input.name, 'o nome da unidade', 120)
  const singularLabel = requiredText(input.singularLabel, 'o rótulo no singular', 120)
  const pluralLabel = optionalText(input.pluralLabel, 'o rótulo no plural', 120)
  const baseMeasure = assertBaseMeasure(input.baseMeasure)
  if (input.measureType !== 'mass' && input.measureType !== 'volume') throw new Error('O tipo de medida deve ser massa ou volume.')
  if (input.measureType === 'mass' && baseMeasure !== 'g') throw new Error('Unidades de massa devem ser informadas em gramas.')
  if (input.measureType === 'volume' && baseMeasure !== 'ml') throw new Error('Unidades de volume devem ser informadas em mililitros.')
  if (input.origin != null && input.origin !== 'catalog' && input.origin !== 'user') throw new Error('A origem da unidade é inválida.')
  if (input.isDefault != null && typeof input.isDefault !== 'boolean') throw new Error('O estado padrão da unidade é inválido.')
  if (input.isActive != null && typeof input.isActive !== 'boolean') throw new Error('O estado da unidade é inválido.')

  const isActive = input.isActive ?? true
  const isDefault = isActive && Boolean(input.isDefault)
  return {
    foodId,
    foodSource,
    name,
    singularLabel,
    pluralLabel,
    measureType: input.measureType,
    baseMeasure,
    amountPerUnit: parseUnitAmount(input.amountPerUnit, baseMeasure),
    isDefault,
    isActive,
    origin: input.origin ?? 'user',
    notes: optionalText(input.notes, 'a observação', 2_000),
  }
}

export const validateFoodDensityProfileDraft = (input: FoodDensityProfileDraft): NormalizedFoodDensityProfileDraft => {
  const foodId = requiredText(input.foodId, 'o alimento', 1_000)
  const foodSource = assertFoodSource(input.foodSource)
  if (input.source !== 'label' && input.source !== 'user' && input.source !== 'professional') throw new Error('A fonte da densidade é inválida.')
  return {
    foodId,
    foodSource,
    gramsPerMl: parseFoodDensity(input.gramsPerMl),
    source: input.source,
    notes: optionalText(input.notes, 'a observação', 2_000),
  }
}

export const isPersistedFoodUnitProfile = (profile: FoodUnitChoice): profile is FoodUnitProfile => !('isPersisted' in profile)

/**
 * Existing `unitWeightG`/`portionWeightG` fields become suggestions only.
 * They are deliberately never copied to a user's Firestore collection.
 */
export const catalogUnitSuggestions = (food: Pick<Food, 'id' | 'baseUnit' | 'unitWeightG' | 'portionWeightG'>, foodSource: FoodSource): CatalogUnitSuggestion[] => {
  const measureType = food.baseUnit === 'g' ? 'mass' : 'volume'
  const suggestions: CatalogUnitSuggestion[] = []
  const create = (kind: 'unidade' | 'porção', amount: unknown) => {
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < FOOD_UNIT_MIN_AMOUNT || amount > FOOD_UNIT_MAX_AMOUNT) return
    const profileName = kind === 'unidade' ? 'Unidade sugerida' : 'Porção sugerida'
    suggestions.push({
      id: `catalog_${foodSource}_${safeIdPart(food.id)}_${kind}`,
      foodId: food.id,
      foodSource,
      name: profileName,
      singularLabel: kind,
      pluralLabel: kind === 'unidade' ? 'unidades' : 'porções',
      measureType,
      baseMeasure: food.baseUnit,
      amountPerUnit: amount,
      isDefault: false,
      isActive: true,
      origin: 'catalog',
      isPersisted: false,
      notes: null,
    })
  }
  create('unidade', food.unitWeightG)
  create('porção', food.portionWeightG)
  return suggestions
}

export const defaultFoodUnitChoice = (profiles: readonly FoodUnitProfile[], suggestions: readonly CatalogUnitSuggestion[] = []) =>
  profiles.find((profile) => profile.isActive && profile.isDefault)
  ?? profiles.find((profile) => profile.isActive)
  ?? suggestions.find((suggestion) => suggestion.isActive)
  ?? null

const sourceForFood = (food: Pick<Food, 'isPublic'>): FoodSource => food.isPublic ? 'public' : 'private'

const directUnitBaseMeasure = (unit: Unit): BaseUnit | null => {
  if (unit === 'g' || unit === 'kg') return 'g'
  if (unit === 'ml' || unit === 'l') return 'ml'
  return null
}

const directUnitAmount = (quantity: number, unit: Unit) => unit === 'kg' || unit === 'l' ? quantity * 1_000 : quantity

const validDensityForFood = (density: FoodDensityProfile | null | undefined, food: Pick<Food, 'id' | 'isPublic'>) => {
  if (!density) return null
  if (density.foodId !== food.id || density.foodSource !== sourceForFood(food)) throw new Error('A densidade selecionada pertence a outro alimento.')
  return parseFoodDensity(density.gramsPerMl)
}

/**
 * Converts only with an explicit density. Equal measures are returned as-is;
 * no generic "1 ml = 1 g" fallback exists anywhere in this helper.
 */
export const convertFoodBaseAmount = (
  amount: number,
  from: BaseUnit,
  to: BaseUnit,
  density: Pick<FoodDensityProfile, 'gramsPerMl'> | null | undefined,
) => {
  if (!Number.isFinite(amount) || amount < 0) throw new Error('A quantidade a converter é inválida.')
  if (from === to) return amount
  const gramsPerMl = density ? parseFoodDensity(density.gramsPerMl) : null
  if (!gramsPerMl) throw new Error('Configure a densidade em g/ml antes de converter entre gramas e mililitros.')
  return from === 'ml' ? amount * gramsPerMl : amount / gramsPerMl
}

const temporaryUnitChoice = (temporaryUnit: TemporaryFoodUnit) => {
  const baseMeasure = assertBaseMeasure(temporaryUnit.baseMeasure)
  const label = optionalText(temporaryUnit.singularLabel, 'o rótulo da unidade', 120)
    ?? optionalText(temporaryUnit.name, 'o nome da unidade', 120)
  if (!label) throw new Error('Informe o nome da unidade temporária.')
  return {
    label,
    baseMeasure,
    amountPerUnit: parseUnitAmount(temporaryUnit.amountPerUnit, baseMeasure),
  }
}

const labelForChoice = (choice: FoodUnitChoice, quantity: number) => {
  if (quantity !== 1 && choice.pluralLabel) return choice.pluralLabel
  return choice.singularLabel || choice.name
}

/**
 * Resolves a selection before persistence. Its result is snapshot-ready and
 * retains the measure entered by the user, while `nutrientBaseAmount` is the
 * only amount used for the 100 g/100 ml nutrient factor.
 */
export const resolveMealItemUnitSelection = (
  food: Pick<Food, 'id' | 'baseUnit' | 'unitWeightG' | 'portionWeightG' | 'isPublic'>,
  quantity: number,
  unit: Unit,
  selection: MealItemUnitSelection = {},
): ResolvedMealItemUnit => {
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Informe uma quantidade maior que zero.')
  if (selection.unitProfile && selection.temporaryUnit) throw new Error('Escolha uma unidade salva ou temporária, não as duas.')

  const expectedSource = sourceForFood(food)
  const suppliedProfile = selection.unitProfile
  if (suppliedProfile) {
    if (!suppliedProfile.isActive) throw new Error('Esta unidade está desativada.')
    if (suppliedProfile.foodId !== food.id || suppliedProfile.foodSource !== expectedSource) throw new Error('A unidade selecionada pertence a outro alimento.')
    const amountPerUnit = parseUnitAmount(suppliedProfile.amountPerUnit, suppliedProfile.baseMeasure)
    const consumedBaseAmount = quantity * amountPerUnit
    const nutrientBaseAmount = convertFoodBaseAmount(
      consumedBaseAmount,
      suppliedProfile.baseMeasure,
      food.baseUnit,
      validDensityForFood(selection.densityProfile, food) ? selection.densityProfile : null,
    )
    return {
      unitProfileId: isPersistedFoodUnitProfile(suppliedProfile) ? suppliedProfile.id : null,
      unitLabelSnapshot: labelForChoice(suppliedProfile, quantity),
      amountPerUnitSnapshot: amountPerUnit,
      baseMeasureSnapshot: suppliedProfile.baseMeasure,
      consumedBaseAmount,
      nutrientBaseAmount,
      nutrientBaseMeasure: food.baseUnit,
    }
  }

  if (selection.temporaryUnit) {
    const temporary = temporaryUnitChoice(selection.temporaryUnit)
    const consumedBaseAmount = quantity * temporary.amountPerUnit
    const nutrientBaseAmount = convertFoodBaseAmount(
      consumedBaseAmount,
      temporary.baseMeasure,
      food.baseUnit,
      validDensityForFood(selection.densityProfile, food) ? selection.densityProfile : null,
    )
    return {
      unitProfileId: null,
      unitLabelSnapshot: temporary.label,
      amountPerUnitSnapshot: temporary.amountPerUnit,
      baseMeasureSnapshot: temporary.baseMeasure,
      consumedBaseAmount,
      nutrientBaseAmount,
      nutrientBaseMeasure: food.baseUnit,
    }
  }

  const directMeasure = directUnitBaseMeasure(unit)
  if (directMeasure) {
    const consumedBaseAmount = directUnitAmount(quantity, unit)
    const nutrientBaseAmount = convertFoodBaseAmount(
      consumedBaseAmount,
      directMeasure,
      food.baseUnit,
      validDensityForFood(selection.densityProfile, food) ? selection.densityProfile : null,
    )
    return {
      unitProfileId: null,
      unitLabelSnapshot: unit,
      amountPerUnitSnapshot: null,
      baseMeasureSnapshot: directMeasure,
      consumedBaseAmount,
      nutrientBaseAmount,
      nutrientBaseMeasure: food.baseUnit,
    }
  }

  const catalogAmount = unit === 'unidade' ? food.unitWeightG : food.portionWeightG
  if (typeof catalogAmount !== 'number' || !Number.isFinite(catalogAmount) || catalogAmount < FOOD_UNIT_MIN_AMOUNT) {
    throw new Error(`Informe uma medida para usar ${unit} neste alimento.`)
  }
  const amountPerUnit = parseUnitAmount(catalogAmount, food.baseUnit)
  return {
    unitProfileId: null,
    unitLabelSnapshot: unit,
    amountPerUnitSnapshot: amountPerUnit,
    baseMeasureSnapshot: food.baseUnit,
    consumedBaseAmount: quantity * amountPerUnit,
    nutrientBaseAmount: quantity * amountPerUnit,
    nutrientBaseMeasure: food.baseUnit,
  }
}
