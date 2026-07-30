import { expect, test } from '@playwright/test'

test.describe('Acesso sem credenciais Firebase', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/entrar')
    await expect(
      page.getByRole('heading', { name: 'Seu bem-estar começa aqui.' }),
    ).toBeVisible()
  })

  test('valida e-mail e senha obrigatórios no navegador', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Entrar na minha conta' }).click()

    await expect(page.getByText('Informe um e-mail válido.')).toBeVisible()
    await expect(page.getByText('Use ao menos 6 caracteres.')).toBeVisible()
  })

  test('valida um e-mail inválido e uma senha curta', async ({ page }) => {
    await page.getByLabel('E-mail').fill('nome-invalido')
    await page.locator('#auth-password').fill('12345')
    await page.getByRole('button', { name: 'Entrar na minha conta' }).click()

    await expect(page.getByText('Informe um e-mail válido.')).toBeVisible()
    await expect(page.getByText('Use ao menos 6 caracteres.')).toBeVisible()
  })

  test('oferece cadastro destacado para quem ainda não tem conta', async ({ page }) => {
    await page.getByRole('button', { name: 'Criar conta grátis' }).click()

    await expect(
      page.getByRole('heading', { name: 'Crie uma rotina mais leve.' }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Criar minha conta' }),
    ).toBeVisible()
  })

  test('oferece recuperação de acesso e valida o formulário localmente', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Esqueci minha senha' }).click()

    await expect(
      page.getByRole('heading', { name: 'Vamos recuperar seu acesso.' }),
    ).toBeVisible()
    await expect(page.locator('#auth-password')).toHaveCount(0)

    await page.getByRole('button', { name: 'Enviar instruções' }).click()
    await expect(page.getByText('Informe um e-mail válido.')).toBeVisible()
  })
})

test('inicializa o tema salvo antes de renderizar a tela de acesso', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('nutripro.theme', 'dark')
  })

  await page.goto('/entrar')

  const documentRoot = page.locator('html')
  await expect(documentRoot).toHaveAttribute('data-theme', 'dark')
  await expect(documentRoot).toHaveClass(/dark/)
})
