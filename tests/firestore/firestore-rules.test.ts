import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import {
  USER_A,
  USER_B,
  authenticated,
  createRulesEnvironment,
  now,
  validMealItem,
  validUnitProfile,
} from './test-helpers'

let environment: RulesTestEnvironment | undefined

beforeAll(async () => {
  environment = await createRulesEnvironment()
})

beforeEach(async () => {
  await environment?.clearFirestore()
})

afterAll(async () => {
  await environment?.cleanup()
})

async function seedPrivateDocument(collectionName: string, id: string, userId: string) {
  if (!environment) throw new Error('Ambiente de regras não inicializado.')
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), collectionName, id), { userId, createdAt: now(), updatedAt: now() })
  })
}

describe('isolamento por proprietário', () => {
  it('impede usuário A de ler, alterar ou excluir dados do usuário B', async () => {
    if (!environment) throw new Error('Ambiente de regras não inicializado.')
    await seedPrivateDocument('profiles', USER_B, USER_B)
    const reference = doc(authenticated(environment, USER_A).firestore(), 'profiles', USER_B)
    await assertFails(getDoc(reference))
    await assertFails(updateDoc(reference, { userId: USER_A }))
    await assertFails(deleteDoc(reference))
  })

  it('impede acesso anônimo a dados privados', async () => {
    if (!environment) throw new Error('Ambiente de regras não inicializado.')
    await seedPrivateDocument('profiles', USER_B, USER_B)
    const anonymous = environment.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(anonymous, 'profiles', USER_B)))
    await assertFails(setDoc(doc(anonymous, 'profiles', 'anonimo'), { userId: 'anonimo' }))
  })

  it('permite ao proprietário ler seu documento e impede troca de userId', async () => {
    if (!environment) throw new Error('Ambiente de regras não inicializado.')
    await seedPrivateDocument('profiles', USER_A, USER_A)
    const reference = doc(authenticated(environment, USER_A).firestore(), 'profiles', USER_A)
    await assertSucceeds(getDoc(reference))
    await assertFails(updateDoc(reference, { userId: USER_B }))
  })
})

describe('mealItems', () => {
  it('aceita um snapshot completo e válido', async () => {
    if (!environment) throw new Error('Ambiente de regras não inicializado.')
    const reference = doc(authenticated(environment, USER_A).firestore(), 'mealItems', 'item-valido')
    await assertSucceeds(setDoc(reference, validMealItem()))
    expect((await getDoc(reference)).exists()).toBe(true)
  })

  it.each([
    ['quantidade zero', { quantity: 0 }],
    ['quantidade excessiva', { quantity: 100001 }],
    ['macro negativo', { protein: -1 }],
    ['data malformada', { date: '05/08/2026' }],
    ['origem inválida', { foodSource: 'global' }],
    ['snapshot sem base positiva', { nutrientBaseAmount: 0 }],
    ['campo crítico inesperado', { admin: true }],
  ])('recusa %s', async (_label, changes) => {
    if (!environment) throw new Error('Ambiente de regras não inicializado.')
    const reference = doc(authenticated(environment, USER_A).firestore(), 'mealItems', `invalido-${String(_label)}`)
    await assertFails(setDoc(reference, { ...validMealItem(), ...changes }))
  })

  it('impede gravar lançamento para outro usuário', async () => {
    if (!environment) throw new Error('Ambiente de regras não inicializado.')
    const reference = doc(authenticated(environment, USER_A).firestore(), 'mealItems', 'item-b')
    await assertFails(setDoc(reference, validMealItem(USER_B)))
  })
})

describe('hidratação, personalizações e favoritos', () => {
  it('aceita água válida e recusa zero, valor excessivo e data inválida', async () => {
    if (!environment) throw new Error('Ambiente de regras não inicializado.')
    const database = authenticated(environment, USER_A).firestore()
    const valid = { userId: USER_A, date: '2026-08-05', amountMl: 300, loggedAt: now(), createdAt: now(), updatedAt: now() }
    await assertSucceeds(setDoc(doc(database, 'waterLogs', 'agua-valida'), valid))
    await assertFails(setDoc(doc(database, 'waterLogs', 'agua-zero'), { ...valid, amountMl: 0 }))
    await assertFails(setDoc(doc(database, 'waterLogs', 'agua-excessiva'), { ...valid, amountMl: 20001 }))
    await assertFails(setDoc(doc(database, 'waterLogs', 'agua-data'), { ...valid, date: 'hoje' }))
  })

  it('valida override e torna publicFoodId e createdAt imutáveis', async () => {
    if (!environment) throw new Error('Ambiente de regras não inicializado.')
    const reference = doc(authenticated(environment, USER_A).firestore(), 'foodOverrides', 'override-a')
    const value = { userId: USER_A, publicFoodId: 'BR0001', name: 'Banana personalizada', calories: 80, isHidden: false, createdAt: now(), updatedAt: now() }
    await assertSucceeds(setDoc(reference, value))
    await assertFails(updateDoc(reference, { publicFoodId: 'BR0002' }))
    await assertFails(updateDoc(reference, { createdAt: new Date() }))
    await assertFails(setDoc(doc(authenticated(environment, USER_A).firestore(), 'foodOverrides', 'negativo'), { ...value, calories: -1 }))
  })

  it('aceita favorito válido e recusa origem ou proprietário inválido', async () => {
    if (!environment) throw new Error('Ambiente de regras não inicializado.')
    const database = authenticated(environment, USER_A).firestore()
    const value = { userId: USER_A, foodId: 'BR0001', foodSource: 'public', createdAt: now() }
    await assertSucceeds(setDoc(doc(database, 'foodFavorites', 'favorito-valido'), value))
    await assertFails(setDoc(doc(database, 'foodFavorites', 'origem-invalida'), { ...value, foodSource: 'global' }))
    await assertFails(setDoc(doc(database, 'foodFavorites', 'outro-dono'), { ...value, userId: USER_B }))
  })

  it('restringe a leitura de favorito ausente ao prefixo determinístico do dono', async () => {
    if (!environment) throw new Error('Ambiente de regras não inicializado.')
    const databaseA = authenticated(environment, USER_A).firestore()
    const databaseB = authenticated(environment, USER_B).firestore()
    const favoritePath = `foodFavorites/${USER_A}_public_BR0001`
    await assertSucceeds(getDoc(doc(databaseA, favoritePath)))
    await assertFails(getDoc(doc(databaseB, favoritePath)))
  })
})

describe('unidades e densidades', () => {
  it('permite ao dono consultar somente seu ID determinístico ainda ausente', async () => {
    if (!environment) throw new Error('Ambiente de regras não inicializado.')
    const databaseA = authenticated(environment, USER_A).firestore()
    const databaseB = authenticated(environment, USER_B).firestore()
    const unitId = `${USER_A}_public_BR0001_banana-media`
    const densityId = `density_${USER_A}_public_BR0001`
    await assertSucceeds(getDoc(doc(databaseA, 'foodUnitProfiles', unitId)))
    await assertSucceeds(getDoc(doc(databaseA, 'foodDensityProfiles', densityId)))
    await assertFails(getDoc(doc(databaseB, 'foodUnitProfiles', unitId)))
    await assertFails(getDoc(doc(databaseB, 'foodDensityProfiles', densityId)))
  })

  it('não confia apenas no prefixo quando um documento existente pertence a outro dono', async () => {
    if (!environment) throw new Error('Ambiente de regras não inicializado.')
    const forgedId = `${USER_A}_public_BR0001_forjado`
    await seedPrivateDocument('foodUnitProfiles', forgedId, USER_B)
    await assertFails(getDoc(doc(authenticated(environment, USER_A).firestore(), 'foodUnitProfiles', forgedId)))
  })

  it('aceita unidade coerente e recusa limites ou combinação de medida inválida', async () => {
    if (!environment) throw new Error('Ambiente de regras não inicializado.')
    const database = authenticated(environment, USER_A).firestore()
    await assertSucceeds(setDoc(doc(database, 'foodUnitProfiles', 'unidade-valida'), validUnitProfile()))
    await assertFails(setDoc(doc(database, 'foodUnitProfiles', 'unidade-zero'), { ...validUnitProfile(), amountPerUnit: 0 }))
    await assertFails(setDoc(doc(database, 'foodUnitProfiles', 'unidade-excessiva'), { ...validUnitProfile(), amountPerUnit: 10001 }))
    await assertFails(setDoc(doc(database, 'foodUnitProfiles', 'unidade-incoerente'), { ...validUnitProfile(), measureType: 'volume' }))
  })

  it('limita densidade a 20 g/ml e isola o proprietário', async () => {
    if (!environment) throw new Error('Ambiente de regras não inicializado.')
    const database = authenticated(environment, USER_A).firestore()
    const value = { userId: USER_A, foodId: 'BR0001', foodSource: 'public', gramsPerMl: 1.05, source: 'label', notes: null, createdAt: now(), updatedAt: now() }
    await assertSucceeds(setDoc(doc(database, 'foodDensityProfiles', 'densidade-valida'), value))
    await assertFails(setDoc(doc(database, 'foodDensityProfiles', 'densidade-zero'), { ...value, gramsPerMl: 0 }))
    await assertFails(setDoc(doc(database, 'foodDensityProfiles', 'densidade-alta'), { ...value, gramsPerMl: 20.01 }))
    await assertFails(setDoc(doc(database, 'foodDensityProfiles', 'densidade-b'), { ...value, userId: USER_B }))
  })
})

describe('avaliações físicas', () => {
  it('aceita o núcleo clínico válido e bloqueia campos de privilégio inesperados', async () => {
    if (!environment) throw new Error('Ambiente de regras não inicializado.')
    const database = authenticated(environment, USER_A).firestore()
    const value = {
      userId: USER_A,
      assessmentDate: '2026-08-05',
      weightKg: 70,
      heightCm: 175,
      bodyFatMethod: 'manual',
      reportedBodyFatPercent: 18.5,
      createdAt: now(),
      updatedAt: now(),
    }
    await assertSucceeds(setDoc(doc(database, 'physicalAssessments', 'avaliacao-valida'), value))
    await assertFails(setDoc(doc(database, 'physicalAssessments', 'avaliacao-admin'), { ...value, admin: true }))
    await assertFails(setDoc(doc(database, 'physicalAssessments', 'avaliacao-peso'), { ...value, weightKg: -1 }))
  })
})
