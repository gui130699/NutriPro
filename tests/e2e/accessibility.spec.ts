import { expect, test } from '@playwright/test'

test('a tela de acesso oferece nomes acessíveis e navegação por teclado', async ({ page }) => {
  await page.goto('/entrar')

  await expect(page.getByLabel('E-mail')).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Senha' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mostrar senha' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Entrar na minha conta' })).toBeVisible()

  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await expect(page.locator(':focus')).toHaveCount(1)
})
