import type { CatalogFood } from './food-catalog'
import type { Food, FoodOverride } from './types'

const editableFoodKeys = [
  'name', 'brand', 'category', 'calories', 'protein', 'carbs', 'fat', 'fiber',
  'unitWeightG', 'portionWeightG', 'notes',
] as const satisfies readonly (keyof Food)[]

/** Combines a local public record with only the authenticated user's override. */
export function mergePublicFoodWithOverride(catalogFood: CatalogFood, override?: FoodOverride, isFavorite = false): Food {
  const original: Food = {
    id: catalogFood.externalId,
    externalId: catalogFood.externalId,
    name: catalogFood.name,
    brand: catalogFood.brand,
    category: catalogFood.category,
    baseUnit: catalogFood.baseUnit,
    calories: catalogFood.calories,
    protein: catalogFood.protein,
    carbs: catalogFood.carbs,
    fat: catalogFood.fat,
    fiber: catalogFood.fiber,
    saturatedFat: catalogFood.saturatedFat,
    sugar: catalogFood.sugar,
    sodium: catalogFood.sodium,
    unitWeightG: catalogFood.unitWeightG,
    portionWeightG: catalogFood.portionWeightG,
    source: catalogFood.source,
    isActive: catalogFood.isActive,
    isPublic: true,
    isFavorite,
    catalogOrigin: catalogFood.catalogOrigin,
    measurementPolicy: catalogFood.measurementPolicy,
  }
  if (!override) return original

  const values: Partial<Food> = override
  const customized: Partial<Food> = {}
  editableFoodKeys.forEach((key) => {
    const value = values[key]
    if (value !== undefined) customized[key] = value as never
  })
  return { ...original, ...customized, id: catalogFood.externalId, externalId: catalogFood.externalId, isPublic: true, isFavorite }
}

export const isPublicFoodHidden = (override?: FoodOverride) => Boolean(override?.isHidden)
