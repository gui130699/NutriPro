import { describe, expect, it } from 'vitest'
import { availableFoodUnits, calculateNutrients, perServing, remaining, sumNutrients, toGrams } from './nutrition'
import type { Food } from './types'

const food: Food = {
  id: '1',
  name: 'Teste',
  baseUnit: 'g',
  calories: 100,
  protein: 10,
  carbs: 20,
  fat: 5,
  fiber: 3,
  unitWeightG: 50,
  portionWeightG: 30,
}

describe('cálculos nutricionais', () => {
  it('converte quilos, unidades e porções para gramas', () => {
    expect(toGrams(1.5, 'kg', food)).toBe(1500)
    expect(toGrams(2, 'unidade', food)).toBe(100)
    expect(toGrams(3, 'porção', food)).toBe(90)
  })

  it('calcula nutrientes sem arredondar', () => {
    expect(calculateNutrients(food, 50, 'g').calories).toBe(50)
  })

  it('oferece somente medidas compatíveis com a base do alimento', () => {
    const milk: Food = { ...food, id: 'milk', name: 'Leite integral', baseUnit: 'ml', unitWeightG: null, portionWeightG: 200 }
    const egg: Food = { ...food, id: 'egg', name: 'Ovo de galinha', baseUnit: 'g', unitWeightG: 50, portionWeightG: 50 }

    expect(availableFoodUnits(milk)).toEqual(['ml', 'l', 'porção'])
    expect(availableFoodUnits(egg)).toEqual(['g', 'kg', 'unidade', 'porção'])
    expect(calculateNutrients(milk, 200, 'ml').calories).toBe(200)
  })

  it('soma e calcula meta restante', () => {
    expect(sumNutrients([
      { calories: 100, protein: 1, carbs: 2, fat: 3, fiber: 4 },
      { calories: 50, protein: 2, carbs: 3, fat: 4, fiber: 5 },
    ]).calories).toBe(150)
    expect(remaining(100, 120)).toBe(0)
  })

  it('calcula receita por porção', () => {
    expect(perServing({ calories: 400, protein: 20, carbs: 40, fat: 10, fiber: 8 }, 4).calories).toBe(100)
  })
})
