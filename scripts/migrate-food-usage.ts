#!/usr/bin/env node

/**
 * One-time, resumable backfill for the foodUsage aggregate.
 *
 * It deliberately never runs in the browser. Each legacy meal item is marked
 * `usageAggregated: true` in the same Admin transaction that increments its
 * aggregate, so a retry cannot double-count it. New app writes already carry
 * that marker and are skipped.
 *
 * Default: dry run (no writes).
 * Apply: npm run migrate:food-usage -- --apply
 *
 * Authentication: set GOOGLE_APPLICATION_CREDENTIALS to a Firebase service
 * account JSON path, or FIREBASE_SERVICE_ACCOUNT_JSON to its JSON contents.
 */
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

const apply = process.argv.includes('--apply')
const concurrency = 12

type FoodUsageSource = 'public' | 'private'

const foodUsageDocumentId = (userId: string, foodSource: FoodUsageSource, foodId: string) =>
  `usage_${encodeURIComponent(userId)}_${foodSource}_${encodeURIComponent(foodId)}`

const asFoodUsageSource = (value: unknown): FoodUsageSource => value === 'public' ? 'public' : 'private'

const currentUsageCount = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0
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

function legacyUsage(data: Record<string, unknown>) {
  const userId = typeof data.userId === 'string' ? data.userId : ''
  const foodId = typeof data.foodId === 'string'
    ? data.foodId
    : typeof data.food_id === 'string'
      ? data.food_id
      : ''

  if (!userId || !foodId) return null
  return { userId, foodId, foodSource: asFoodUsageSource(data.foodSource) }
}

async function backfillMealItem(mealItemId: string) {
  const database = getFirestore()
  return database.runTransaction(async (transaction) => {
    const mealItemRef = database.collection('mealItems').doc(mealItemId)
    const mealItem = await transaction.get(mealItemRef)
    if (!mealItem.exists || mealItem.get('usageAggregated') === true) return 'already-counted' as const

    const usage = legacyUsage(mealItem.data())
    if (!usage) return 'invalid' as const

    const usageRef = database.collection('foodUsage').doc(foodUsageDocumentId(usage.userId, usage.foodSource, usage.foodId))
    const existingUsage = await transaction.get(usageRef)
    const count = existingUsage.exists ? currentUsageCount(existingUsage.get('usageCount')) : 0
    const now = FieldValue.serverTimestamp()

    transaction.update(mealItemRef, {
      usageAggregated: true,
      usageAggregatedAt: now,
      updatedAt: now,
    })
    transaction.set(usageRef, {
      userId: usage.userId,
      foodId: usage.foodId,
      foodSource: usage.foodSource,
      usageCount: count + 1,
      lastUsedAt: now,
      updatedAt: now,
      ...(!existingUsage.exists || existingUsage.get('createdAt') === undefined
        ? { createdAt: now }
        : {}),
    }, { merge: true })
    return 'counted' as const
  })
}

async function migrate() {
  createAdminApp()
  const database = getFirestore()
  const snapshot = await database.collection('mealItems').get()
  const pending = snapshot.docs.filter((item) => item.get('usageAggregated') !== true)
  const invalid = pending.filter((item) => !legacyUsage(item.data())).length

  console.log(`${snapshot.size} lançamento(s) de refeição encontrado(s).`)
  console.log(`${pending.length - invalid} lançamento(s) legado(s) elegível(is) para agregação.`)
  if (invalid) console.log(`${invalid} lançamento(s) sem userId ou foodId foram preservados e ignorados.`)

  if (!apply) {
    console.log('Modo de simulação: nenhuma alteração foi gravada. Execute novamente com --apply para confirmar.')
    return
  }

  let counted = 0
  let skipped = invalid
  for (let offset = 0; offset < pending.length; offset += concurrency) {
    const results = await Promise.all(pending.slice(offset, offset + concurrency).map((item) => backfillMealItem(item.id)))
    counted += results.filter((result) => result === 'counted').length
    skipped += results.filter((result) => result !== 'counted').length
  }

  console.log(`Migração concluída: ${counted} lançamento(s) agregado(s); ${skipped} ignorado(s).`)
}

migrate().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
