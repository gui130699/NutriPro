#!/usr/bin/env node

/**
 * Optional one-time migration for old diary entries that only contain
 * `mealName`. The application already reads those entries safely; run this
 * script only when a permanent snapshot migration is desired.
 *
 * Default: dry run (no writes).
 * Apply:   npm run migrate:meals -- --apply
 *
 * Authentication: set GOOGLE_APPLICATION_CREDENTIALS to a Firebase service
 * account JSON path, or FIREBASE_SERVICE_ACCOUNT_JSON to its JSON contents.
 */
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

type StoredMealType = {
  id: string
  name: string
  icon?: string
}

const apply = process.argv.includes('--apply')

const normalize = (value: unknown) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()
  .replace(/\s+/g, ' ')

const fallbackIcons: Record<string, string> = {
  'cafe da manha': 'coffee',
  'lanche da manha': 'sparkles',
  almoco: 'sun',
  'lanche da tarde': 'water',
  jantar: 'dinner',
  ceia: 'moon',
}

function createAdminApp() {
  if (getApps().length) return getApps()[0]!
  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (rawServiceAccount) return initializeApp({ credential: cert(JSON.parse(rawServiceAccount)) })
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error('Defina GOOGLE_APPLICATION_CREDENTIALS ou FIREBASE_SERVICE_ACCOUNT_JSON antes de executar a migração.')
  }
  return initializeApp({ credential: applicationDefault() })
}

async function loadMealTypes(userId: string, cache: Map<string, StoredMealType[]>) {
  const cached = cache.get(userId)
  if (cached) return cached
  const database = getFirestore()
  const snapshot = await database.collection('mealTypes').where('userId', '==', userId).get()
  const types = snapshot.docs.map((document) => ({
    id: document.id,
    name: String(document.get('name') ?? ''),
    icon: typeof document.get('icon') === 'string' ? document.get('icon') : undefined,
  }))
  cache.set(userId, types)
  return types
}

async function migrate() {
  createAdminApp()
  const database = getFirestore()
  const mealTypesByUser = new Map<string, StoredMealType[]>()
  const snapshot = await database.collection('mealItems').get()
  const updates: Array<{ id: string; data: Record<string, unknown> }> = []

  for (const document of snapshot.docs) {
    const data = document.data()
    const userId = typeof data.userId === 'string' ? data.userId : ''
    const legacyName = typeof data.mealName === 'string' ? data.mealName : ''
    const hasSnapshot = typeof data.mealNameSnapshot === 'string' && typeof data.mealIconSnapshot === 'string'
    if (!userId || (!legacyName && hasSnapshot)) continue

    const types = await loadMealTypes(userId, mealTypesByUser)
    const existingId = typeof data.mealTypeId === 'string' ? data.mealTypeId : ''
    const resolvedType = types.find((item) => item.id === existingId)
      ?? types.find((item) => normalize(item.name) === normalize(data.mealNameSnapshot ?? legacyName))
    const name = typeof data.mealNameSnapshot === 'string' && data.mealNameSnapshot.trim()
      ? data.mealNameSnapshot.trim()
      : resolvedType?.name || legacyName || 'Refeição'
    const icon = typeof data.mealIconSnapshot === 'string' && data.mealIconSnapshot.trim()
      ? data.mealIconSnapshot.trim()
      : resolvedType?.icon || fallbackIcons[normalize(name)] || 'utensils'
    const patch: Record<string, unknown> = {
      mealNameSnapshot: name,
      mealIconSnapshot: icon,
      updatedAt: FieldValue.serverTimestamp(),
    }
    if (!existingId && resolvedType) patch.mealTypeId = resolvedType.id
    updates.push({ id: document.id, data: patch })
  }

  console.log(`${updates.length} lançamento(s) legado(s) identificado(s).`)
  if (!apply) {
    console.log('Modo de simulação: nenhuma alteração foi gravada. Execute novamente com --apply para confirmar.')
    return
  }

  for (let offset = 0; offset < updates.length; offset += 400) {
    const batch = database.batch()
    updates.slice(offset, offset + 400).forEach((update) => batch.update(database.collection('mealItems').doc(update.id), update.data))
    await batch.commit()
  }
  console.log(`Migração concluída: ${updates.length} lançamento(s) atualizado(s).`)
}

migrate().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
