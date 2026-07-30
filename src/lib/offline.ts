import Dexie, { type EntityTable } from 'dexie'
import type { CatalogFood } from './food-catalog'

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

type NutriProDatabase = Dexie & {
  pending: EntityTable<Pending, 'id'>
  catalogFoods: EntityTable<CatalogFood, 'externalId'>
  catalogMetadata: EntityTable<CatalogMetadata, 'key'>
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

export const enqueueOffline = (table: string, payload: Record<string, unknown>) => offlineDb.pending.put({
  id: crypto.randomUUID(),
  table,
  payload,
  createdAt: new Date().toISOString(),
})

/** Deletes an item only after its remote mutation succeeds. */
export const syncPending = async (insert: (table: string, row: Record<string, unknown>) => Promise<void>) => {
  const pending = await offlineDb.pending.toArray()
  for (const item of pending) {
    await insert(item.table, item.payload)
    await offlineDb.pending.delete(item.id)
  }
}

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
