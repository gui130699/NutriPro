import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { Timestamp } from 'firebase/firestore'

export const TEST_PROJECT_ID = 'nutripro-test'
export const USER_A = 'usuario-a'
export const USER_B = 'usuario-b'

export async function createRulesEnvironment(): Promise<RulesTestEnvironment> {
  const host = process.env.FIRESTORE_EMULATOR_HOST?.split(':')[0] ?? '127.0.0.1'
  const port = Number(process.env.FIRESTORE_EMULATOR_HOST?.split(':')[1] ?? 8080)
  return initializeTestEnvironment({
    projectId: TEST_PROJECT_ID,
    firestore: {
      host,
      port,
      rules: readFileSync(resolve('firestore.rules'), 'utf8'),
    },
  })
}

export const authenticated = (environment: RulesTestEnvironment, userId: string): RulesTestContext =>
  environment.authenticatedContext(userId, { email: `${userId}@nutripro.test` })

export const now = () => Timestamp.fromDate(new Date('2026-08-05T12:00:00.000Z'))

export function validMealItem(userId = USER_A) {
  const timestamp = now()
  return {
    userId,
    date: '2026-08-05',
    mealTypeId: 'cafe-da-manha',
    mealNameSnapshot: 'Café da manhã',
    mealIconSnapshot: 'coffee',
    foodId: 'BR0001',
    foodSource: 'public',
    foodNameSnapshot: 'Banana',
    quantity: 1,
    unit: 'unidade',
    calories: 72,
    protein: 0.9,
    carbs: 18.4,
    fat: 0.2,
    fiber: 2,
    saturatedFat: 0,
    sugar: 0,
    sodium: 0,
    unitWeightGSnapshot: 80,
    unitProfileId: null,
    unitLabelSnapshot: 'unidade média',
    amountPerUnitSnapshot: 80,
    baseMeasureSnapshot: 'g',
    consumedBaseAmount: 80,
    nutrientBaseAmount: 80,
    consumedGrams: 80,
    usageAggregated: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function validUnitProfile(userId = USER_A) {
  const timestamp = now()
  return {
    userId,
    foodId: 'BR0001',
    foodSource: 'public',
    name: 'Banana média',
    singularLabel: 'banana média',
    pluralLabel: 'bananas médias',
    measureType: 'mass',
    baseMeasure: 'g',
    amountPerUnit: 80,
    isDefault: true,
    isActive: true,
    origin: 'user',
    notes: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}
