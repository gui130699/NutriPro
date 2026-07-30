import { describe, expect, it } from 'vitest'
import {
  filterMealIconOptions,
  mealIconKeys,
  mealIcons,
  normalizeMealIconSearch,
} from './meal-icons'

describe('catálogo de ícones de refeições', () => {
  it('disponibiliza todas as chaves persistíveis solicitadas', () => {
    expect(mealIconKeys).toHaveLength(33)
    expect(mealIconKeys).toEqual(expect.arrayContaining([
      'coffee',
      'soda',
      'water',
      'milk',
      'apple',
      'banana',
      'cherry',
      'salad',
      'soup',
      'sandwich',
      'pizza',
      'beef',
      'chicken',
      'fish',
      'egg',
      'wheat',
      'croissant',
      'cake',
      'cookie',
      'iceCream',
      'utensils',
      'dinner',
      'pot',
      'moon',
      'sun',
      'sunrise',
      'sunset',
      'sparkles',
      'workout',
      'heart',
      'star',
      'clock',
      'plus',
    ]))
    expect(Object.keys(mealIcons)).toHaveLength(mealIconKeys.length)
  })

  it('pesquisa por texto sem diferenciar acentos ou maiúsculas', () => {
    expect(normalizeMealIconSearch('  CAFÉ  ')).toBe('cafe')
    expect(filterMealIconOptions('café').map((option) => option.key)).toContain('coffee')
    expect(filterMealIconOptions('SANDUICHE').map((option) => option.key)).toContain('sandwich')
  })
})
