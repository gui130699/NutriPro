import { expect, test } from '@playwright/test'
import {
  USER_A_EMAIL,
  adminDb,
  clearEmulators,
  closeAdminApp,
  createTestUser,
  login,
  seedCompletedProfile,
} from './helpers'

test.beforeEach(async () => {
  await clearEmulators()
})

test.afterAll(async () => {
  await closeAdminApp()
})

async function completedUser() {
  const user = await createTestUser(USER_A_EMAIL)
  await seedCompletedProfile(user.uid, 'Usuário A')
  return user
}

test('perfil atualiza dados, metas, peso histórico e expõe versões reais', async ({ page }) => {
  const user = await completedUser()
  await login(page, USER_A_EMAIL)
  await page.goto('/perfil')
  await expect(page.getByRole('heading', { name: /Tudo sobre você/ })).toBeVisible()
  await expect(page.getByText('NutriPro 0.9.0')).toBeVisible()
  await expect(page.getByText(/Catálogo 2\.0\.0-br/)).toBeVisible()

  await page.getByLabel('Como podemos chamar você?').fill('Usuária Atualizada')
  await page.getByLabel('Peso atual (kg)').fill('71,4')
  await page.getByLabel('Meta de peso (kg)').fill('68')
  await page.getByLabel('Hidratação (ml)').fill('2700')
  await page.getByRole('button', { name: 'Salvar preferências' }).click()
  await expect(page.getByRole('status')).toContainText('salv')

  await expect.poll(async () => (await adminDb().collection('weightLogs').where('userId', '==', user.uid).get()).size).toBe(1)
  const [profile, goals, weight] = await Promise.all([
    adminDb().collection('profiles').doc(user.uid).get(),
    adminDb().collection('goals').doc(user.uid).get(),
    adminDb().collection('weightLogs').where('userId', '==', user.uid).get(),
  ])
  expect(profile.data()).toMatchObject({ name: 'Usuária Atualizada' })
  expect(goals.data()).toMatchObject({ waterMl: 2700, weightGoalKg: 68 })
  expect(weight.docs[0].data()).toMatchObject({ weightKg: 71.4, source: 'profile' })
})

test('hidratação rejeita valor inválido, registra e exclui o lançamento correto', async ({ page }) => {
  const user = await completedUser()
  await login(page, USER_A_EMAIL)
  await page.goto('/diario')
  const water = page.getByLabel('Outro valor de água')
  await water.fill('-1')
  await page.locator('.water-custom').getByRole('button', { name: 'Adicionar' }).click()
  await expect(page.getByText('Informe uma quantidade de água maior que zero.')).toBeVisible()

  await water.fill('350')
  await page.locator('.water-custom').getByRole('button', { name: 'Adicionar' }).click()
  await expect.poll(async () => (await adminDb().collection('waterLogs').where('userId', '==', user.uid).get()).size).toBe(1)
  await expect(page.getByText('+ 350 ml')).toBeVisible()
  await page.getByRole('button', { name: 'Excluir 350 ml de água' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Excluir', exact: true }).click()
  await expect.poll(async () => (await adminDb().collection('waterLogs').where('userId', '==', user.uid).get()).size).toBe(0)
})

test('evolução e medidas corporais preservam históricos independentes', async ({ page }) => {
  const user = await completedUser()
  await login(page, USER_A_EMAIL)
  await page.goto('/evolucao')
  await page.locator('header').getByRole('button', { name: 'Novo registro' }).click()
  const weightDialog = page.getByRole('dialog', { name: 'Novo registro de peso' })
  await weightDialog.getByLabel('Peso (kg)').fill('70,8')
  await weightDialog.getByLabel('Horário (opcional)').fill('07:30')
  await weightDialog.getByLabel('Observação (opcional)').fill('Teste autenticado')
  await weightDialog.getByRole('button', { name: 'Salvar registro' }).click()
  await expect.poll(async () => (await adminDb().collection('weightLogs').where('userId', '==', user.uid).get()).size).toBe(1)

  await page.getByRole('link', { name: /Medidas corporais/ }).click()
  await page.getByRole('button', { name: 'Nova medição' }).first().click()
  const measurementDialog = page.getByRole('dialog', { name: 'Nova medição' })
  await measurementDialog.getByLabel('Cintura').fill('79,5')
  await measurementDialog.getByLabel('Quadril').fill('98')
  await measurementDialog.getByLabel('Observações').fill('Primeira medição')
  await measurementDialog.getByRole('button', { name: 'Salvar medição' }).click()
  await expect.poll(async () => (await adminDb().collection('bodyMeasurements').where('userId', '==', user.uid).get()).size).toBe(1)
  const measurement = (await adminDb().collection('bodyMeasurements').where('userId', '==', user.uid).get()).docs[0].data()
  expect(measurement).toMatchObject({ waistCm: 79.5, hipCm: 98, notes: 'Primeira medição' })
})

test('avaliação física manual calcula e persiste os campos informados', async ({ page }) => {
  const user = await completedUser()
  await login(page, USER_A_EMAIL)
  await page.goto('/evolucao/avaliacao-fisica')
  await page.getByRole('button', { name: 'Nova avaliação' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Nova avaliação' })
  await dialog.getByLabel('Nome do avaliador').fill('Profissional Teste')
  await dialog.getByLabel('Peso (kg)').fill('70')
  await dialog.getByLabel('Altura (cm)').fill('175')
  await dialog.getByLabel('Método').selectOption('manual')
  await dialog.getByLabel('Percentual de gordura informado (%)').fill('18,5')
  await dialog.getByLabel('Cintura (cm)').fill('80')
  await dialog.getByRole('button', { name: 'Salvar avaliação' }).click()
  await expect.poll(async () => (await adminDb().collection('physicalAssessments').where('userId', '==', user.uid).get()).size).toBe(1)
  const assessment = (await adminDb().collection('physicalAssessments').where('userId', '==', user.uid).get()).docs[0].data()
  expect(assessment).toMatchObject({ evaluatorName: 'Profissional Teste', weightKg: 70, heightCm: 175, bodyFatMethod: 'manual', reportedBodyFatPercent: 18.5, waistCm: 80 })
  expect(assessment.bmi).toBeCloseTo(22.86, 1)
})

test('listas criam alimento particular e mantêm bebida TACO explicitamente em 100 g', async ({ page }) => {
  const user = await completedUser()
  await login(page, USER_A_EMAIL)
  await page.goto('/listas')
  await page.getByRole('button', { name: 'Novo alimento' }).click()
  const dialog = page.getByRole('dialog', { name: 'Novo alimento particular' })
  await dialog.getByLabel('Nome do alimento').fill('Receita particular de teste')
  await dialog.getByLabel('Categoria').fill('Testes')
  await dialog.getByLabel('Calorias').fill('123')
  await dialog.getByLabel('Proteínas').fill('4')
  await dialog.getByLabel('Carboidratos').fill('20')
  await dialog.getByRole('spinbutton', { name: 'Gorduras g', exact: true }).fill('3')
  await dialog.getByLabel('Fibras').fill('2')
  await dialog.getByRole('button', { name: 'Salvar alimento' }).click()
  await expect.poll(async () => (await adminDb().collection('foods').where('userId', '==', user.uid).get()).size).toBe(1)

  await page.getByRole('button', { name: /Lista pública/ }).click()
  await page.getByPlaceholder('Busque por nome, marca ou categoria').fill('Bebida isotônica')
  const card = page.getByRole('heading', { name: 'Bebida isotônica, sabores variados' }).locator('xpath=ancestor::article')
  await card.getByRole('button', { name: 'Detalhes' }).click()
  const details = page.getByRole('dialog', { name: 'Bebida isotônica, sabores variados' })
  await expect(details.getByText('100 g', { exact: true })).toBeVisible()
})
