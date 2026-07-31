import { describe, expect, it, vi } from 'vitest'
import type { FoodFormValues } from '../components/foods/FoodForm'
import { createPrivateFoodWithFavorite } from './AddFood'

const values: FoodFormValues = {
  name: 'Iogurte natural',
  brand: '',
  category: 'Laticinios',
  calories: 61,
  protein: 3.5,
  carbs: 4.7,
  fat: 3.3,
  fiber: 0,
  saturatedFat: undefined,
  sugar: undefined,
  sodium: undefined,
  baseUnit: 'g',
  unitWeightG: undefined,
  portionWeightG: undefined,
  source: '',
  notes: '',
  isFavorite: true,
  isActive: true,
}

function writer() {
  return {
    createFood: vi.fn(async (_userId: string, _input: unknown) => 'private-food-42'),
    setFavorite: vi.fn(async (_userId: string, _foodId: string, _source: 'public' | 'private', _active: boolean) => undefined),
  }
}

describe('AddFood favorite persistence', () => {
  it('writes a checked favorite through the user-scoped private favorite record', async () => {
    const service = writer()

    await createPrivateFoodWithFavorite('user-1', values, service)

    expect(service.createFood).toHaveBeenCalledWith('user-1', expect.objectContaining({ name: 'Iogurte natural', isActive: true }))
    expect(service.createFood.mock.calls[0]?.[1]).not.toHaveProperty('isFavorite')
    expect(service.setFavorite).toHaveBeenCalledWith('user-1', 'private-food-42', 'private', true)
  })

  it('does not create a favorite record when the checkbox is off', async () => {
    const service = writer()

    await createPrivateFoodWithFavorite('user-1', { ...values, isFavorite: false }, service)

    expect(service.createFood).toHaveBeenCalledTimes(1)
    expect(service.setFavorite).not.toHaveBeenCalled()
  })
})
