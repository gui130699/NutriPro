import { describe, expect, it } from 'vitest'
import {
  FOOD_UNIT_MAX_AMOUNT,
  FOOD_DENSITY_MAX_GRAMS_PER_ML,
  catalogUnitSuggestions,
  convertFoodBaseAmount,
  defaultFoodUnitChoice,
  foodDensityProfileId,
  foodUnitProfileId,
  normalizeUnitProfileName,
  parseUnitAmount,
  parseFoodDensity,
  resolveMealItemUnitSelection,
  validateFoodUnitProfileDraft,
} from './food-units'
import type { Food, FoodDensityProfile, FoodUnitProfile } from './types'

const banana: Food = {
  id: 'BR0070',
  name: 'Banana-prata crua',
  baseUnit: 'g',
  calories: 98,
  protein: 1.3,
  carbs: 26,
  fat: 0.1,
  fiber: 2,
  isPublic: true,
}

const milk: Food = {
  ...banana,
  id: 'BR0056',
  name: 'Leite integral',
  baseUnit: 'ml',
}

const bananaProfile: FoodUnitProfile = {
  id: 'unit_user-1_public_BR0070_banana-media',
  userId: 'user-1',
  foodId: 'BR0070',
  foodSource: 'public',
  name: 'Banana média',
  singularLabel: 'banana média',
  pluralLabel: 'bananas médias',
  measureType: 'mass',
  baseMeasure: 'g',
  amountPerUnit: 80,
  isDefault: true,
  isActive: true,
  origin: 'user',
}

describe('unidades inteligentes de alimentos', () => {
  it('normaliza nomes e cria ids determinísticos por usuário, origem e alimento', () => {
    expect(normalizeUnitProfileName(' BANANA média! ')).toBe('banana-media')
    expect(foodUnitProfileId('user-a', 'public', 'BR0070', 'Banana média'))
      .toBe('user-a_public_BR0070_banana-media')
    expect(foodUnitProfileId('user-a', 'public', 'BR0070', 'Banana média'))
      .toBe(foodUnitProfileId('user-a', 'public', 'BR0070', 'BANANA MEDIA'))
    expect(foodDensityProfileId('user/a', 'public', 'BR/0070')).toContain('user%2Fa')
    expect(foodUnitProfileId('user_with_underscore', 'public', 'food_id', 'Fatia'))
      .toBe('user_with_underscore_public_food_id_fatia')
  })

  it('calcula uma, duas e quantidades decimais de uma unidade salva sem alterar o snapshot', () => {
    const one = resolveMealItemUnitSelection(banana, 1, 'unidade', { unitProfile: bananaProfile })
    const two = resolveMealItemUnitSelection(banana, 2, 'unidade', { unitProfile: bananaProfile })
    const decimal = resolveMealItemUnitSelection(banana, 1.5, 'unidade', { unitProfile: bananaProfile })

    expect(one).toMatchObject({
      unitProfileId: bananaProfile.id,
      unitLabelSnapshot: 'banana média',
      amountPerUnitSnapshot: 80,
      baseMeasureSnapshot: 'g',
      consumedBaseAmount: 80,
      nutrientBaseAmount: 80,
    })
    expect(two.unitLabelSnapshot).toBe('bananas médias')
    expect(two.consumedBaseAmount).toBe(160)
    expect(decimal.consumedBaseAmount).toBe(120)

    const changedProfile = { ...bananaProfile, amountPerUnit: 85 }
    expect(resolveMealItemUnitSelection(banana, 1, 'unidade', { unitProfile: changedProfile }).consumedBaseAmount).toBe(85)
    expect(one.consumedBaseAmount).toBe(80)
  })

  it('aceita uma unidade temporária sem criar perfil e respeita g, kg, ml e l', () => {
    expect(resolveMealItemUnitSelection(banana, 2, 'unidade', {
      temporaryUnit: { name: 'Fatia', amountPerUnit: '25,5', baseMeasure: 'g' },
    })).toMatchObject({ unitProfileId: null, unitLabelSnapshot: 'Fatia', consumedBaseAmount: 51, nutrientBaseAmount: 51 })

    expect(resolveMealItemUnitSelection(banana, 1.5, 'kg').nutrientBaseAmount).toBe(1500)
    expect(resolveMealItemUnitSelection(milk, 200, 'ml').nutrientBaseAmount).toBe(200)
    expect(resolveMealItemUnitSelection(milk, 1.25, 'l').nutrientBaseAmount).toBe(1250)
  })

  it('oferece sugestão virtual do catálogo e escolhe primeiro a unidade padrão ativa do usuário', () => {
    const suggestions = catalogUnitSuggestions({ ...banana, unitWeightG: 80, portionWeightG: 100 }, 'public')
    expect(suggestions).toEqual(expect.arrayContaining([
      expect.objectContaining({ isPersisted: false, origin: 'catalog', amountPerUnit: 80 }),
      expect.objectContaining({ isPersisted: false, origin: 'catalog', amountPerUnit: 100 }),
    ]))
    expect(defaultFoodUnitChoice([{ ...bananaProfile, isDefault: false }, bananaProfile], suggestions)?.id).toBe(bananaProfile.id)
  })

  it('bloqueia conversão massa-volume sem densidade e usa a densidade configurada quando ela existe', () => {
    expect(() => resolveMealItemUnitSelection(milk, 100, 'g')).toThrow('Configure a densidade')
    const density: FoodDensityProfile = {
      id: 'density_user-1_public_BR0056',
      userId: 'user-1',
      foodId: milk.id,
      foodSource: 'public',
      gramsPerMl: 1.03,
      source: 'label',
    }
    const resolved = resolveMealItemUnitSelection(milk, 103, 'g', { densityProfile: density })
    expect(resolved.consumedBaseAmount).toBe(103)
    expect(resolved.nutrientBaseAmount).toBeCloseTo(100)
    expect(convertFoodBaseAmount(250, 'ml', 'g', density)).toBeCloseTo(257.5)
  })

  it('valida vírgula decimal, limites, tipo de medida e valores inválidos', () => {
    expect(parseUnitAmount('80,5', 'g')).toBe(80.5)
    expect(() => parseUnitAmount('0', 'g')).toThrow('entre')
    expect(() => parseUnitAmount('-1', 'ml')).toThrow('entre')
    expect(() => parseUnitAmount('abc', 'g')).toThrow('número válido')
    expect(() => parseUnitAmount(FOOD_UNIT_MAX_AMOUNT + 0.1, 'g')).toThrow('entre')
    expect(parseFoodDensity('1,05')).toBe(1.05)
    expect(() => parseFoodDensity(FOOD_DENSITY_MAX_GRAMS_PER_ML + 0.01)).toThrow('no máximo')
    expect(() => validateFoodUnitProfileDraft({
      foodId: banana.id,
      foodSource: 'public',
      name: 'Copo',
      singularLabel: 'copo',
      measureType: 'mass',
      baseMeasure: 'ml',
      amountPerUnit: 200,
    })).toThrow('massa')
  })
})
