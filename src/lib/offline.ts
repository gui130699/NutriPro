import Dexie, { type EntityTable } from 'dexie'
import type { CatalogFood } from './food-catalog'
import type { FoodDensityProfile, FoodUnitProfile } from './types'

export type Pending = {
  id: string
  table: string
  payload: Record<string, unknown>
  createdAt: string
}

/** Metadata is stored separately so checking a catalogue update never reads all foods. */
export type CatalogMetadata = {
  key: string
  version: string
  updatedAt: string
  totalFoods: number
  cachedAt: string
}

export type CatalogMetadataInput = Omit<CatalogMetadata, 'cachedAt'>

export const FOOD_UNIT_PROFILE_PENDING_TABLE = 'foodUnitProfiles'
export const FOOD_DENSITY_PROFILE_PENDING_TABLE = 'foodDensityProfiles'

/**
 * Deterministic pending operations replace an older operation for the same
 * profile. This makes a later online sync idempotent instead of duplicating a
 * user-created unit after reconnecting.
 */
export type FoodUnitProfilePendingOperation =
  | { kind: 'upsert'; userId: string; profile: FoodUnitProfile }
  | { kind: 'delete'; userId: string; profileId: string }

export type FoodDensityProfilePendingOperation =
  | { kind: 'upsert'; userId: string; profile: FoodDensityProfile }
  | { kind: 'delete'; userId: string; profileId: string }

type NutriProDatabase = Dexie & {
  pending: EntityTable<Pending, 'id'>
  catalogFoods: EntityTable<CatalogFood, 'externalId'>
  catalogMetadata: EntityTable<CatalogMetadata, 'key'>
  foodUnitProfiles: EntityTable<FoodUnitProfile, 'id'>
  foodDensityProfiles: EntityTable<FoodDensityProfile, 'id'>
}

/**
 * Version 2 adds an offline copy of the public catalogue.  The original
 * `pending` store is kept verbatim so users with queued writes are not reset.
 */
export const offlineDb = new Dexie('nutripro') as NutriProDatabase
offlineDb.version(1).stores({ pending: 'id, table, createdAt' })
offlineDb.version(2).stores({
  pending: 'id, table, createdAt',
  catalogFoods: '&externalId, nameNormalized, *searchKeywords, category, brand, isActive',
  catalogMetadata: '&key',
})
offlineDb.version(3).stores({
  pending: 'id, table, createdAt',
  catalogFoods: '&externalId, nameNormalized, *searchKeywords, category, brand, isActive',
  catalogMetadata: '&key',
  foodUnitProfiles: '&id, userId, [userId+foodId+foodSource+isActive], [userId+foodId+isDefault], foodId, foodSource, isActive, isDefault',
  foodDensityProfiles: '&id, userId, [userId+foodId+foodSource], foodId, foodSource',
})

export const enqueueOffline = (table: string, payload: Record<string, unknown>) => offlineDb.pending.put({
  id: crypto.randomUUID(),
  table,
  payload,
  createdAt: new Date().toISOString(),
})

/** Stores the newest mutation for a stable entity id without duplicating its queue entry. */
export const enqueueOfflineDeterministic = async (id: string, table: string, payload: Record<string, unknown>) => {
  const existing = await offlineDb.pending.get(id)
  return offlineDb.pending.put({
    id,
    table,
    payload,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  })
}

export const enqueueFoodUnitProfileOperation = (operation: FoodUnitProfilePendingOperation) => {
  const profileId = operation.kind === 'upsert' ? operation.profile.id : operation.profileId
  return enqueueOfflineDeterministic(
    `food-unit-profile:${profileId}`,
    FOOD_UNIT_PROFILE_PENDING_TABLE,
    operation as unknown as Record<string, unknown>,
  )
}

export const enqueueFoodDensityProfileOperation = (operation: FoodDensityProfilePendingOperation) => {
  const profileId = operation.kind === 'upsert' ? operation.profile.id : operation.profileId
  return enqueueOfflineDeterministic(
    `food-density-profile:${profileId}`,
    FOOD_DENSITY_PROFILE_PENDING_TABLE,
    operation as unknown as Record<string, unknown>,
  )
}

/** Deletes an item only after its remote mutation succeeds. */
export const syncPending = async (insert: (table: string, row: Record<string, unknown>) => Promise<void>) => {
  const pending = await offlineDb.pending.toArray()
  for (const item of pending) {
    await insert(item.table, item.payload)
    await offlineDb.pending.delete(item.id)
  }
}

const isFoodUnitProfileOperation = (value: unknown): value is FoodUnitProfilePendingOperation => {
  if (!value || typeof value !== 'object' || !('kind' in value) || !('userId' in value)) return false
  const operation = value as { kind?: unknown; userId?: unknown }
  return typeof operation.userId === 'string' && (operation.kind === 'upsert' || operation.kind === 'delete')
}

const isFoodDensityProfileOperation = (value: unknown): value is FoodDensityProfilePendingOperation => {
  if (!value || typeof value !== 'object' || !('kind' in value) || !('userId' in value)) return false
  const operation = value as { kind?: unknown; userId?: unknown }
  return typeof operation.userId === 'string' && (operation.kind === 'upsert' || operation.kind === 'delete')
}

/**
 * Explicit opt-in sync hook. It touches only the selected user's queued
 * mutations and leaves failed entries in IndexedDB for a later retry.
 */
export async function syncFoodUnitProfileOperations(
  userId: string,
  apply: (operation: FoodUnitProfilePendingOperation) => Promise<void>,
): Promise<number> {
  const pending = await offlineDb.pending.toArray()
  let synced = 0
  for (const item of pending) {
    if (item.table !== FOOD_UNIT_PROFILE_PENDING_TABLE || !isFoodUnitProfileOperation(item.payload) || item.payload.userId !== userId) continue
    await apply(item.payload)
    await offlineDb.pending.delete(item.id)
    synced += 1
  }
  return synced
}

export async function syncFoodDensityProfileOperations(
  userId: string,
  apply: (operation: FoodDensityProfilePendingOperation) => Promise<void>,
): Promise<number> {
  const pending = await offlineDb.pending.toArray()
  let synced = 0
  for (const item of pending) {
    if (item.table !== FOOD_DENSITY_PROFILE_PENDING_TABLE || !isFoodDensityProfileOperation(item.payload) || item.payload.userId !== userId) continue
    await apply(item.payload)
    await offlineDb.pending.delete(item.id)
    synced += 1
  }
  return synced
}

export const pendingFoodUnitProfileIds = async (userId: string) => {
  const pending = await offlineDb.pending.toArray()
  return new Set(pending.flatMap((item) => {
    if (item.table !== FOOD_UNIT_PROFILE_PENDING_TABLE || !isFoodUnitProfileOperation(item.payload) || item.payload.userId !== userId) return []
    return [item.payload.kind === 'upsert' ? item.payload.profile.id : item.payload.profileId]
  }))
}

export const pendingFoodDensityProfileIds = async (userId: string) => {
  const pending = await offlineDb.pending.toArray()
  return new Set(pending.flatMap((item) => {
    if (item.table !== FOOD_DENSITY_PROFILE_PENDING_TABLE || !isFoodDensityProfileOperation(item.payload) || item.payload.userId !== userId) return []
    return [item.payload.kind === 'upsert' ? item.payload.profile.id : item.payload.profileId]
  }))
}

export const cacheFoodUnitProfiles = (profiles: readonly FoodUnitProfile[]) => offlineDb.foodUnitProfiles.bulkPut([...profiles])

export const cacheFoodUnitProfile = (profile: FoodUnitProfile) => offlineDb.foodUnitProfiles.put(profile)

export const getCachedFoodUnitProfile = (profileId: string) => offlineDb.foodUnitProfiles.get(profileId)

export const removeCachedFoodUnitProfile = (profileId: string) => offlineDb.foodUnitProfiles.delete(profileId)

export async function getCachedFoodUnitProfiles(userId: string, foodId?: string, foodSource?: FoodUnitProfile['foodSource'], includeInactive = false) {
  const profiles = await offlineDb.foodUnitProfiles.where('userId').equals(userId).toArray()
  return profiles
    .filter((profile) => (!foodId || profile.foodId === foodId)
      && (!foodSource || profile.foodSource === foodSource)
      && (includeInactive || profile.isActive))
    .sort((left, right) => Number(right.isDefault) - Number(left.isDefault) || left.name.localeCompare(right.name, 'pt-BR'))
}

export const cacheFoodDensityProfile = (profile: FoodDensityProfile) => offlineDb.foodDensityProfiles.put(profile)

export const removeCachedFoodDensityProfile = (profileId: string) => offlineDb.foodDensityProfiles.delete(profileId)

export const getCachedFoodDensityProfile = (profileId: string) => offlineDb.foodDensityProfiles.get(profileId)

export const getCachedCatalogFoods = () => offlineDb.catalogFoods.orderBy('nameNormalized').toArray()

export const getCachedCatalogMetadata = (key: string) => offlineDb.catalogMetadata.get(key)

/** Atomically swaps a catalogue only after the complete JSON has been downloaded and validated. */
export async function replaceCachedCatalogFoods(foods: readonly CatalogFood[], metadata: CatalogMetadataInput): Promise<void> {
  await offlineDb.transaction('rw', offlineDb.catalogFoods, offlineDb.catalogMetadata, async () => {
    await offlineDb.catalogFoods.clear()
    if (foods.length > 0) await offlineDb.catalogFoods.bulkPut([...foods])
    await offlineDb.catalogMetadata.put({ ...metadata, cachedAt: new Date().toISOString() })
  })
}

export async function clearCachedCatalog(): Promise<void> {
  await offlineDb.transaction('rw', offlineDb.catalogFoods, offlineDb.catalogMetadata, async () => {
    await offlineDb.catalogFoods.clear()
    await offlineDb.catalogMetadata.clear()
  })
}
