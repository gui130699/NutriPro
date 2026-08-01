import { describe, expect, it } from 'vitest'
import sourceFoods from '../../public/data/foods.json'
import { searchCatalogFoods } from './food-search'
import { availableFoodUnits } from './nutrition'
import type { CatalogFood } from './food-catalog'
import type { Food } from './types'

const foods = sourceFoods as CatalogFood[]

const findFood = (name: string) => {
  const food = foods.find((item) => item.name === name)
  if (!food) throw new Error(`Alimento obrigatório ausente: ${name}`)
  return food
}

const asFood = (food: CatalogFood): Food => ({
  id: food.externalId,
  externalId: food.externalId,
  name: food.name,
  category: food.category,
  brand: food.brand,
  baseUnit: food.baseUnit,
  calories: food.calories,
  protein: food.protein,
  carbs: food.carbs,
  fat: food.fat,
  fiber: food.fiber,
  unitWeightG: food.unitWeightG,
  portionWeightG: food.portionWeightG,
  source: food.source,
  isActive: food.isActive,
  isPublic: true,
})

describe('catálogo brasileiro 2.0.0-br', () => {
  it('tem 126 curados preservados e 500 itens TACO válidos, únicos e em português', () => {
    expect(foods).toHaveLength(626)
    const curated = foods.filter((food) => food.catalogOrigin === 'curated-br')
    const taco = foods.filter((food) => food.catalogOrigin === 'taco')
    expect(curated).toHaveLength(126)
    expect(taco).toHaveLength(500)
    expect(curated[0]?.externalId).toBe('BR0001')
    expect(curated.at(-1)?.externalId).toBe('BR0126')
    expect(new Set(foods.map((food) => food.externalId)).size).toBe(626)

    for (const food of foods) {
      expect(food.name.trim()).not.toBe('')
      expect(food.nameNormalized.trim()).not.toBe('')
      expect(food.searchKeywords.length).toBeGreaterThan(0)
      expect(food.language).toBe('pt-BR')
      expect(food.baseQuantity).toBe(100)
      expect(['g', 'ml']).toContain(food.baseUnit)
      expect([food.calories, food.protein, food.carbs, food.fat, food.fiber].every((value) => value >= 0)).toBe(true)
    }
    for (const food of taco) {
      expect(food.externalId).toMatch(/^TACO\d{4}$/)
      expect(food.sourceFoodNumber).toBeGreaterThan(0)
      expect(food.source).toBe('TACO 4ª ed. NEPA/UNICAMP')
    }
  })

  it('localiza os alimentos brasileiros por nome, sem acento e por categoria', () => {
    const expectedNames = [
      'Arroz branco tipo 1 cozido',
      'Feijão carioca cozido',
      'Peito de frango grelhado sem pele',
      'Ovo de galinha cozido',
      'Leite integral',
      'Banana-prata crua',
      'Pão francês',
      'Azeite de oliva extra virgem',
      'Sorvete de creme',
    ]

    for (const name of expectedNames) expect(findFood(name).externalId).toMatch(/^BR\d{4}$/)
    expect(searchCatalogFoods(foods, { query: 'pao' }).foods.map((food) => food.name)).toContain('Pão francês')
    expect(searchCatalogFoods(foods, { query: 'feijao carioca' }).foods.map((food) => food.name)).toContain('Feijão carioca cozido')
    expect(searchCatalogFoods(foods, { query: 'carnes e derivados' }).total).toBeGreaterThan(0)
  })

  it('mantém bebidas em ml e sólidos em g, com unidades calculáveis', () => {
    const milk = asFood(findFood('Leite integral'))
    const egg = asFood(findFood('Ovo de galinha cozido'))

    expect(milk.baseUnit).toBe('ml')
    expect(availableFoodUnits(milk)).toEqual(['ml', 'l', 'porção'])
    expect(egg.baseUnit).toBe('g')
    expect(availableFoodUnits(egg)).toEqual(['g', 'kg', 'unidade', 'porção'])
  })
})
