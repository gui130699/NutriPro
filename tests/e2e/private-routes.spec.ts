import { expect, test } from '@playwright/test'

for (const route of ['/', '/onboarding', '/listas', '/diario', '/perfil']) {
  test(`a rota protegida ${route} redireciona visitante para o acesso`, async ({ page }) => {
    await page.goto(route)
    await expect(page).toHaveURL(/\/entrar$/)
    await expect(page.getByRole('heading', { name: 'Seu bem-estar começa aqui.' })).toBeVisible()
  })
}
