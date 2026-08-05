import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { FieldValue } from 'firebase-admin/firestore'
import {
  TEST_PASSWORD,
  USER_A_EMAIL,
  USER_B_EMAIL,
  adminDb,
  clearEmulators,
  closeAdminApp,
  createTestUser,
  expectDashboard,
  login,
  seedCompletedProfile,
} from './helpers'

async function indexedDbCount(page: Page, storeName: string): Promise<number> {
  return page.evaluate((name) => new Promise<number>((resolve, reject) => {
    const request = indexedDB.open('nutripro')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const database = request.result
      const countRequest = database.transaction(name, 'readonly').objectStore(name).count()
      countRequest.onerror = () => reject(countRequest.error)
      countRequest.onsuccess = () => resolve(countRequest.result)
    }
  }), storeName)
}

test.beforeEach(async () => {
  await clearEmulators()
})

test.afterAll(async () => {
  await closeAdminApp()
})

test('perfil completo abre área privada; ausente abre onboarding', async ({ page }) => {
  const userA = await createTestUser(USER_A_EMAIL)
  await seedCompletedProfile(userA.uid, 'Usuário A')
  await login(page, USER_A_EMAIL)
  await expectDashboard(page)

  await page.getByRole('link', { name: 'Perfil' }).first().click()
  await page.getByRole('button', { name: 'Sair da conta' }).click()
  await expect(page).toHaveURL(/\/entrar$/)
  const userB = await createTestUser(USER_B_EMAIL)
  expect(userB.uid).not.toBe(userA.uid)
  await login(page, USER_B_EMAIL)
  await expect(page).toHaveURL(/\/onboarding$/)
  await expect(page.getByRole('heading', { name: 'Conte um pouco sobre você.' })).toBeVisible()
})

test('falha de permissão do perfil mostra estado recuperável sem redirecionamento incorreto', async ({ page }) => {
  await createTestUser(USER_A_EMAIL)
  await page.route('http://127.0.0.1:8080/**', async (route) => {
    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 403, message: 'PERMISSION_DENIED', status: 'PERMISSION_DENIED' } }),
    })
  })
  await login(page, USER_A_EMAIL)
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Não foi possível verificar seu perfil.' })).toBeVisible()
  await expect(page.getByText('Confira sua conexão e tente novamente.')).toBeVisible()
  await page.getByRole('button', { name: 'Tentar novamente' }).click()
  await expect(page.getByRole('heading', { name: 'Não foi possível verificar seu perfil.' })).toBeVisible()
  await page.getByRole('button', { name: 'Sair da conta' }).click()
  await expect(page).toHaveURL(/\/entrar$/)
  await page.unroute('http://127.0.0.1:8080/**')
})

test('onboarding cria perfil, metas e peso inicial uma única vez', async ({ page }) => {
  const user = await createTestUser(USER_A_EMAIL)
  await login(page, USER_A_EMAIL)
  await expect(page).toHaveURL(/\/onboarding$/)

  await page.getByLabel('Como podemos chamar você?').fill('Usuário A')
  await page.getByLabel('Data de nascimento').fill('1999-06-13')
  await page.getByLabel('Objetivo principal').selectOption({ label: 'Manutenção' })
  await page.getByLabel(/Altura/).fill('175')
  await page.getByLabel(/Peso atual/).fill('72.5')
  await page.getByLabel(/Meta diária de calorias/).fill('2100')
  await page.getByLabel(/Proteínas/).fill('130')
  await page.getByLabel(/Carboidratos/).fill('240')
  await page.getByLabel(/Gorduras/).fill('70')
  await page.getByLabel(/Fibras/).fill('30')
  await page.getByLabel(/Meta de hidratação/).fill('2500')
  await page.getByRole('button', { name: 'Salvar e começar' }).dblclick()
  await expectDashboard(page)
  await page.reload()
  await expectDashboard(page)

  const [profile, goals, weights] = await Promise.all([
    adminDb().collection('profiles').where('userId', '==', user.uid).get(),
    adminDb().collection('goals').where('userId', '==', user.uid).get(),
    adminDb().collection('weightLogs').where('userId', '==', user.uid).get(),
  ])
  expect(profile.size).toBe(1)
  expect(goals.size).toBe(1)
  expect(weights.size).toBe(1)
})

test('interface não mostra alimento particular de outra conta', async ({ page }) => {
  const userA = await createTestUser(USER_A_EMAIL)
  const userB = await createTestUser(USER_B_EMAIL)
  await seedCompletedProfile(userA.uid, 'Usuário A')
  await seedCompletedProfile(userB.uid, 'Usuário B')
  await adminDb().collection('foods').add({
    userId: userB.uid,
    name: 'Alimento secreto do usuário B',
    brand: null,
    description: null,
    category: 'Teste',
    baseUnit: 'g',
    calories: 100,
    protein: 1,
    carbs: 1,
    fat: 1,
    fiber: 1,
    saturatedFat: 0,
    sugar: 0,
    sodium: 0,
    unitWeightG: null,
    portionWeightG: null,
    source: null,
    notes: null,
    isActive: true,
    isPublic: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
  await login(page, USER_A_EMAIL)
  await expectDashboard(page)
  await page.getByRole('link', { name: 'Listas' }).first().click()
  await page.getByRole('button', { name: /Minha lista/ }).click()
  await expect(page.getByText('Alimento secreto do usuário B')).toHaveCount(0)
})

test('unidade direta abre modal, preserva quantidade e grava snapshot histórico', async ({ page }) => {
  const user = await createTestUser(USER_A_EMAIL)
  await seedCompletedProfile(user.uid, 'Usuário A')
  await adminDb().collection('foods').doc('banana-sem-medida').set({
    userId: user.uid,
    name: 'Banana sem medida cadastrada',
    brand: null,
    description: null,
    category: 'Frutas',
    baseUnit: 'g',
    calories: 98,
    protein: 1.3,
    carbs: 26,
    fat: 0.1,
    fiber: 2,
    saturatedFat: 0,
    sugar: 0,
    sodium: 0,
    unitWeightG: null,
    portionWeightG: null,
    source: null,
    notes: null,
    isActive: true,
    isPublic: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
  await login(page, USER_A_EMAIL)
  await expectDashboard(page)
  await page.getByRole('link', { name: 'Meu diário' }).first().click()
  await expect(page.getByRole('heading', { name: /Seu diário/ })).toBeVisible()

  await page.getByLabel('Pesquisar alimento').fill('Banana sem medida cadastrada')
  await page.getByRole('option', { name: /Banana sem medida cadastrada/ }).click()
  await page.getByLabel('Quantidade').fill('2')
  await page.getByLabel('Unidade').selectOption('unidade')
  const dialog = page.getByRole('dialog', { name: /Informar medida para Banana sem medida cadastrada/ })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Nome da medida').fill('Banana média')
  await dialog.getByLabel('Peso ou volume em g').fill('80')
  await dialog.getByLabel('Rótulo singular').fill('banana média')
  await dialog.getByLabel('Rótulo plural').fill('bananas médias')
  await dialog.getByRole('button', { name: /Salvar para as próximas vezes/ }).click()
  await expect(page.getByLabel('Quantidade')).toHaveValue('2')
  await page.locator('#add-meal').getByRole('button', { name: 'Adicionar', exact: true }).click()

  await expect.poll(async () => (await adminDb().collection('mealItems').where('userId', '==', user.uid).get()).size).toBe(1)
  const item = (await adminDb().collection('mealItems').where('userId', '==', user.uid).get()).docs[0].data()
  expect(item).toMatchObject({ amountPerUnitSnapshot: 80, consumedBaseAmount: 160, nutrientBaseAmount: 160, unitLabelSnapshot: 'bananas médias' })
})

test('catálogo em cache e fila de unidade sobrevivem offline e sincronizam na reconexão', async ({ page, context }) => {
  test.slow()
  const user = await createTestUser(USER_A_EMAIL)
  await seedCompletedProfile(user.uid, 'Usuário A')
  await login(page, USER_A_EMAIL)
  await expectDashboard(page)
  await page.getByRole('link', { name: 'Meu diário' }).first().click()
  await expect(page.getByRole('heading', { name: /Seu diário/ })).toBeVisible()
  await expect.poll(() => indexedDbCount(page, 'catalogFoods')).toBe(626)

  await page.getByLabel('Pesquisar alimento').fill('Bebida isotônica')
  await page.getByRole('option', { name: /Bebida isotônica, sabores variados/ }).click()
  await page.getByLabel('Unidade').selectOption('new-unit')
  const dialog = page.getByRole('dialog', { name: /Informar medida para Bebida isotônica/ })
  await expect(dialog).toBeVisible()

  await context.setOffline(true)
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false)
  await dialog.getByLabel('Nome da medida').fill('Garrafa offline')
  await dialog.getByLabel('Peso ou volume em g').fill('500')
  await dialog.getByLabel('Rótulo singular').fill('garrafa')
  await dialog.getByLabel('Rótulo plural').fill('garrafas')
  await dialog.getByRole('button', { name: /Salvar para as próximas vezes/ }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText(/Aguardando sincronização/)).toBeVisible()
  await expect.poll(() => indexedDbCount(page, 'pending')).toBe(1)

  await page.getByLabel('Pesquisar alimento').fill('Arroz integral')
  await expect(page.locator('.food-picker-results').getByRole('option').first()).toBeVisible()

  await context.setOffline(false)
  await expect.poll(async () => (await adminDb().collection('foodUnitProfiles').where('userId', '==', user.uid).get()).size, { timeout: 20_000 }).toBe(1)
  await expect.poll(() => indexedDbCount(page, 'pending'), { timeout: 20_000 }).toBe(0)
  const profile = (await adminDb().collection('foodUnitProfiles').where('userId', '==', user.uid).get()).docs[0].data()
  expect(profile).toMatchObject({ name: 'Garrafa offline', amountPerUnit: 500, foodSource: 'public', isActive: true })
})

test('credenciais inválidas permanecem em português no Auth Emulator', async ({ page }) => {
  await createTestUser(USER_A_EMAIL)
  await page.goto('/entrar')
  await page.getByLabel('E-mail').fill(USER_A_EMAIL)
  await page.locator('#auth-password').fill(`${TEST_PASSWORD}-incorreta`)
  await page.getByRole('button', { name: 'Entrar na minha conta' }).click()
  await expect(page.getByText('E-mail ou senha incorretos. Tente novamente.')).toBeVisible()
})

test('dashboard autenticado não possui violações WCAG A/AA detectáveis pelo axe', async ({ page }) => {
  const user = await createTestUser(USER_A_EMAIL)
  await seedCompletedProfile(user.uid, 'Usuário A')
  await login(page, USER_A_EMAIL)
  await expectDashboard(page)
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(accessibility.violations, JSON.stringify(accessibility.violations, null, 2)).toEqual([])
})
