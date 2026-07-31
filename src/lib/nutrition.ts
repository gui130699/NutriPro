import type { Food, Nutrients, Unit } from './types'

/** Returns only measures that preserve the food's declared nutrition base. */
export const availableFoodUnits = (food: Pick<Food, 'baseUnit' | 'unitWeightG' | 'portionWeightG'>): Unit[] => {
  const baseUnits: Unit[] = food.baseUnit === 'ml' ? ['ml', 'l'] : ['g', 'kg']
  if (Number(food.unitWeightG) > 0) baseUnits.push('unidade')
  if (Number(food.portionWeightG) > 0) baseUnits.push('porção')
  return baseUnits
}

export const toGrams = (quantity: number, unit: Unit, food: Pick<Food, 'unitWeightG' | 'portionWeightG'>) => {
  if (unit === 'g' || unit === 'ml') return quantity
  if (unit === 'kg' || unit === 'l') return quantity * 1000
  if (unit === 'unidade') return quantity * Number(food.unitWeightG ?? 0)
  return quantity * Number(food.portionWeightG ?? 0)
}
export const calculateNutrients = (food: Food, quantity: number, unit: Unit): Nutrients & { grams: number } => {
  const grams = toGrams(quantity, unit, food); const factor = grams / 100
  return { grams, calories: food.calories * factor, protein: food.protein * factor, carbs: food.carbs * factor, fat: food.fat * factor, fiber: food.fiber * factor, saturatedFat: (food.saturatedFat ?? 0) * factor, sugar: (food.sugar ?? 0) * factor, sodium: (food.sodium ?? 0) * factor }
}
export const sumNutrients = (items: Nutrients[]) => items.reduce<Nutrients>((acc, item) => ({ calories: acc.calories + item.calories, protein: acc.protein + item.protein, carbs: acc.carbs + item.carbs, fat: acc.fat + item.fat, fiber: acc.fiber + item.fiber }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 })
export const remaining = (goal: number, consumed: number) => Math.max(0, goal - consumed)
export const perServing = (total: Nutrients, servings: number) => Object.fromEntries(Object.entries(total).map(([key, value]) => [key, Number(value) / servings])) as Nutrients
export const br = (value: number, digits = 0) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: digits }).format(value)
