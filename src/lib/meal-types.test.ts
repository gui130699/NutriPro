import { describe, expect, it } from 'vitest'
import {
  createDefaultMealTypes,
  getDefaultMealType,
  resolveMealIconKey,
  resolveMealType,
  resolveMealTypeSnapshot,
} from './meal-types'

describe('tipos de refeição', () => {
  it('cria os seis tipos iniciais com ids estáveis por usuário', () => {
    const firstSeed = createDefaultMealTypes('user/a')
    const secondSeed = createDefaultMealTypes('user/a')

    expect(firstSeed).toHaveLength(6)
    expect(firstSeed.map((meal) => meal.name)).toEqual([
      'Café da manhã',
      'Lanche da manhã',
      'Almoço',
      'Lanche da tarde',
      'Jantar',
      'Ceia',
    ])
    expect(firstSeed.map((meal) => meal.id)).toEqual(secondSeed.map((meal) => meal.id))
    expect(firstSeed[0]?.id).toContain('user%2Fa')
  })

  it('resolve aliases de ícones usados por registros legados', () => {
    expect(resolveMealIconKey('GlassWater')).toBe('water')
    expect(resolveMealIconKey('UtensilsCrossed')).toBe('dinner')
    expect(resolveMealIconKey('ícone inexistente', 'moon')).toBe('moon')
  })

  it('converte documentos antigos em um tipo atual válido', () => {
    const meal = resolveMealType({
      id: 'meal-1',
      user_id: 'user-1',
      meal_name: 'Café da manhã',
      meal_icon: 'GlassWater',
      sort_order: '2',
      is_active: 'false',
      is_default: true,
      suggested_time: '07:30',
    })

    expect(meal).toMatchObject({
      id: 'meal-1',
      userId: 'user-1',
      name: 'Café da manhã',
      icon: 'water',
      order: 2,
      isActive: false,
      isDefault: true,
      suggestedTime: '07:30',
    })
  })

  it('mantém os snapshots do diário e recupera itens antigos sem snapshot', () => {
    const lunch = createDefaultMealTypes('user-1').find((meal) => meal.name === 'Almoço')
    if (!lunch) throw new Error('Refeição padrão não encontrada.')

    expect(resolveMealTypeSnapshot({
      mealTypeId: lunch.id,
      mealNameSnapshot: 'Almoço especial',
      mealIconSnapshot: 'heart',
    }, [lunch])).toEqual({
      mealTypeId: lunch.id,
      mealNameSnapshot: 'Almoço especial',
      mealIconSnapshot: 'heart',
    })

    expect(resolveMealTypeSnapshot({ mealName: 'Ceia' })).toEqual({
      mealTypeId: null,
      mealNameSnapshot: 'Ceia',
      mealIconSnapshot: 'moon',
    })
  })

  it('reconhece nomes padrão independentemente de acentos', () => {
    expect(getDefaultMealType('cafe da manha')?.icon).toBe('coffee')
    expect(getDefaultMealType('Almoço')?.id).toBe('lunch')
  })
})
