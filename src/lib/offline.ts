import Dexie, { type EntityTable } from 'dexie'

type Pending = { id: string; table: string; payload: Record<string, unknown>; createdAt: string }
const db = new Dexie('nutripro') as Dexie & { pending: EntityTable<Pending, 'id'> }
db.version(1).stores({ pending: 'id, table, createdAt' })
export const enqueueOffline = (table: string, payload: Record<string, unknown>) => db.pending.put({ id: crypto.randomUUID(), table, payload, createdAt: new Date().toISOString() })
export const syncPending = async (insert: (table: string, row: Record<string, unknown>) => Promise<void>) => { const pending = await db.pending.toArray(); for (const item of pending) { await insert(item.table, item.payload); await db.pending.delete(item.id) } }
