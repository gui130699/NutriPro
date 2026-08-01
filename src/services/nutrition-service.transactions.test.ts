import { beforeEach, describe, expect, it, vi } from 'vitest'

const firestore = vi.hoisted(() => {
  const transaction = {
    get: vi.fn(),
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }

  return {
    transaction,
    addDoc: vi.fn(),
    collection: vi.fn((_database: unknown, name: string) => ({ name })),
    deleteDoc: vi.fn(),
    doc: vi.fn((...args: unknown[]) => {
      if (args.length === 1) return { collection: (args[0] as { name: string }).name, id: 'new-meal' }
      return { collection: args[1], id: args[2] }
    }),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    limit: vi.fn(),
    orderBy: vi.fn(),
    query: vi.fn(),
    runTransaction: vi.fn(async (_database: unknown, callback: (transaction: unknown) => unknown) => callback(transaction)),
    serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    where: vi.fn(),
    writeBatch: vi.fn(),
  }
})

vi.mock('firebase/firestore', () => firestore)
vi.mock('../lib/firebase', () => ({ db: {} }))

import { nutritionService } from './nutrition-service'

const snapshot = (exists: boolean, data: Record<string, unknown> = {}) => ({
  exists: () => exists,
  data: () => data,
})

const meal = {
  id: 'breakfast',
  userId: 'user-1',
  name: 'Café da manhã',
  icon: 'coffee',
  color: null,
  suggestedTime: '07:00',
  order: 0,
  isActive: true,
  isDefault: true,
}

const food = {
  id: 'food-42',
  name: 'Alimento de teste',
  baseUnit: 'g' as const,
  calories: 100,
  protein: 10,
  carbs: 12,
  fat: 4,
  fiber: 3,
  isPublic: false,
}

describe('nutritionService meal usage transactions', () => {
  beforeEach(() => {
    firestore.transaction.get.mockReset()
    firestore.transaction.set.mockReset()
    firestore.transaction.update.mockReset()
    firestore.transaction.delete.mockReset()
    firestore.runTransaction.mockClear()
    firestore.serverTimestamp.mockClear()
  })

  it('creates a meal item and its source-qualified usage aggregate in one transaction', async () => {
    firestore.transaction.get.mockResolvedValue(snapshot(false))

    await nutritionService.addMealItem('user-1', '2026-07-30', meal, food, 100, 'g')

    expect(firestore.runTransaction).toHaveBeenCalledTimes(1)
    expect(firestore.transaction.set).toHaveBeenCalledTimes(2)

    const writes = firestore.transaction.set.mock.calls
    const mealWrite = writes.find(([reference]) => reference.collection === 'mealItems')
    const usageWrite = writes.find(([reference]) => reference.collection === 'foodUsage')

    expect(mealWrite?.[1]).toMatchObject({
      userId: 'user-1',
      foodId: 'food-42',
      foodSource: 'private',
      usageAggregated: true,
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: 'SERVER_TIMESTAMP',
    })
    expect(usageWrite?.[1]).toMatchObject({
      userId: 'user-1',
      foodId: 'food-42',
      foodSource: 'private',
      usageCount: 1,
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: 'SERVER_TIMESTAMP',
    })
  })

  it('extends new meal items with an immutable custom-unit snapshot while keeping legacy fields', async () => {
    firestore.transaction.get.mockResolvedValue(snapshot(false))
    const unitProfile = {
      id: 'unit_user-1_private_food-42_fatia-media',
      userId: 'user-1',
      foodId: 'food-42',
      foodSource: 'private' as const,
      name: 'Fatia média',
      singularLabel: 'fatia média',
      pluralLabel: 'fatias médias',
      measureType: 'mass' as const,
      baseMeasure: 'g' as const,
      amountPerUnit: 25,
      isDefault: true,
      isActive: true,
      origin: 'user' as const,
    }

    await nutritionService.addMealItem('user-1', '2026-07-30', meal, food, 2, 'unidade', { unitProfile })

    const mealWrite = firestore.transaction.set.mock.calls
      .find(([reference]) => reference.collection === 'mealItems')?.[1] as Record<string, unknown>
    expect(mealWrite).toMatchObject({
      unit: 'unidade',
      unitProfileId: unitProfile.id,
      unitLabelSnapshot: 'fatias médias',
      amountPerUnitSnapshot: 25,
      baseMeasureSnapshot: 'g',
      consumedBaseAmount: 50,
      consumedGrams: 50,
      calories: 50,
    })
  })

  it('deletes the meal item and decrements the matching aggregate atomically', async () => {
    firestore.transaction.get.mockImplementation(async (reference: { collection: string }) => {
      if (reference.collection === 'mealItems') {
        return snapshot(true, { userId: 'user-1', foodId: 'food-42', foodSource: 'public' })
      }
      return snapshot(true, { usageCount: 2 })
    })

    await nutritionService.deleteMealItem('user-1', 'meal-1')

    expect(firestore.runTransaction).toHaveBeenCalledTimes(1)
    expect(firestore.transaction.delete).toHaveBeenCalledTimes(1)
    expect(firestore.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'foodUsage' }),
      expect.objectContaining({ usageCount: 1, updatedAt: 'SERVER_TIMESTAMP' }),
    )
  })

  it('preserves createdAt when an existing public-food override is edited', async () => {
    firestore.transaction.get.mockResolvedValue(snapshot(true, { userId: 'user-1', createdAt: 'old-created-at' }))

    await nutritionService.saveFoodOverride('user-1', 'public-42', { isHidden: true })

    const payload = firestore.transaction.set.mock.calls[0]?.[1] as Record<string, unknown>
    expect(payload).toMatchObject({ userId: 'user-1', publicFoodId: 'public-42', isHidden: true, updatedAt: 'SERVER_TIMESTAMP' })
    expect(payload).not.toHaveProperty('createdAt')
  })
})
