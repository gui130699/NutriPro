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
    deleteField: vi.fn(() => 'DELETE_FIELD'),
    doc: vi.fn((...args: unknown[]) => {
      if (args.length === 1) return { collection: (args[0] as { name: string }).name, id: 'new-meal' }
      return { collection: args[1], id: args[2] }
    }),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    limit: vi.fn((value: number) => ({ kind: 'limit', value })),
    orderBy: vi.fn(),
    query: vi.fn((source: unknown, ...constraints: unknown[]) => ({ source, constraints })),
    runTransaction: vi.fn(async (_database: unknown, callback: (transaction: unknown) => unknown) => callback(transaction)),
    serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    where: vi.fn((field: string, operator: string, value: unknown) => ({ kind: 'where', field, operator, value })),
    writeBatch: vi.fn(),
  }
})

vi.mock('firebase/firestore', () => firestore)
vi.mock('../lib/firebase', () => ({ db: {} }))
vi.mock('../lib/offline', () => ({
  cacheFoodDensityProfile: vi.fn(async () => undefined),
  cacheFoodUnitProfile: vi.fn(async () => undefined),
  cacheFoodUnitProfiles: vi.fn(async () => undefined),
  enqueueFoodDensityProfileOperation: vi.fn(async () => undefined),
  enqueueFoodUnitProfileOperation: vi.fn(async () => undefined),
  getCachedFoodDensityProfile: vi.fn(async () => null),
  getCachedFoodUnitProfile: vi.fn(async () => null),
  getCachedFoodUnitProfiles: vi.fn(async () => []),
  pendingFoodDensityProfileIds: vi.fn(async () => new Set()),
  pendingFoodUnitProfileIds: vi.fn(async () => new Set()),
  removeCachedFoodDensityProfile: vi.fn(async () => undefined),
  removeCachedFoodUnitProfile: vi.fn(async () => undefined),
  syncFoodDensityProfileOperations: vi.fn(async () => 0),
  syncFoodUnitProfileOperations: vi.fn(async () => 0),
}))

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
    firestore.getDoc.mockReset()
    firestore.getDocs.mockReset()
    firestore.deleteDoc.mockReset()
    firestore.query.mockClear()
    firestore.where.mockClear()
    firestore.limit.mockClear()
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
      nutrientBaseAmount: 50,
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

  it('verifica uso de unidade com consultas canônica e legada limitadas a um item', async () => {
    firestore.getDoc.mockResolvedValue(snapshot(true, { userId: 'user-1' }))
    firestore.getDocs.mockResolvedValue({ docs: [] })

    await nutritionService.deleteFoodUnitProfile('user-1', 'profile-42', true)

    expect(firestore.limit).toHaveBeenCalledTimes(2)
    expect(firestore.limit).toHaveBeenNthCalledWith(1, 1)
    expect(firestore.limit).toHaveBeenNthCalledWith(2, 1)
    expect(firestore.where).toHaveBeenCalledWith('unitProfileId', '==', 'profile-42')
    expect(firestore.where).toHaveBeenCalledWith('unit_profile_id', '==', 'profile-42')
    expect(firestore.deleteDoc).toHaveBeenCalledWith(expect.objectContaining({ collection: 'foodUnitProfiles', id: 'profile-42' }))
  })

  it('busca somente perfis do mesmo usuário, alimento e origem ao definir o padrão', async () => {
    const profile = {
      userId: 'user-1', foodId: 'food-42', foodSource: 'private', name: 'Fatia',
      singularLabel: 'fatia', measureType: 'mass', baseMeasure: 'g', amountPerUnit: 25,
      isDefault: false, isActive: true, origin: 'user',
    }
    firestore.getDoc.mockResolvedValue(snapshot(true, profile))
    firestore.getDocs.mockResolvedValue({ docs: [] })
    firestore.transaction.get.mockResolvedValue(snapshot(true, profile))

    await nutritionService.setDefaultFoodUnitProfile('user-1', 'profile-42')

    expect(firestore.where).toHaveBeenCalledWith('userId', '==', 'user-1')
    expect(firestore.where).toHaveBeenCalledWith('foodId', '==', 'food-42')
    expect(firestore.where).toHaveBeenCalledWith('foodSource', '==', 'private')
    expect(firestore.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'foodUnitProfiles', id: 'profile-42' }),
      expect.objectContaining({ isDefault: true }),
    )
  })
})
