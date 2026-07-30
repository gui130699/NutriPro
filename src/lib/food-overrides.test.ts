import { describe, expect, it } from 'vitest'
import { normalizeCatalogFood } from './food-catalog'
import { isPublicFoodHidden, mergePublicFoodWithOverride } from './food-overrides'
import type { FoodOverride } from './types'

const banana = normalizeCatalogFood({
  externalId: 'banana-1', name: 'Banana', category: 'Frutas', calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3, fiber: 2.6,
})

const override: FoodOverride = {
  id: 'user-1_banana-1',
  userId: 'user-1',
  publicFoodId: 'banana-1',
  name: 'Banana-prata',
  calories: 98,
  isHidden: true,
}

describe('personalizações de alimentos públicos', () => {
  it('aplica a personalização local sem alterar o catálogo original', () => {
    const personalized = mergePublicFoodWithOverride(banana, override, true)

    expect(personalized).toMatchObject({ name: 'Banana-prata', calories: 98, isFavorite: true, isPublic: true })
    expect(banana).toMatchObject({ name: 'Banana', calories: 89 })
  })

  it('restaura o original ao remover a personalização', () => {
    const restored = mergePublicFoodWithOverride(banana)
    expect(restored).toMatchObject({ name: 'Banana', calories: 89, isPublic: true })
  })

  it('identifica alimentos ocultos e restaurados pela conta atual', () => {
    expect(isPublicFoodHidden(override)).toBe(true)
    expect(isPublicFoodHidden({ ...override, isHidden: false })).toBe(false)
    expect(isPublicFoodHidden()).toBe(false)
  })
})
