import { expect, test } from '@playwright/test'

test.describe('instalação do aplicativo', () => {
  test('oferece e aciona o prompt nativo no navegador compatível', async ({ page }) => {
    await page.goto('/entrar')
    await expect(page.getByRole('heading', { name: 'Seu bem-estar começa aqui.' })).toBeVisible()

    await page.evaluate(() => {
      const installEvent = new Event('beforeinstallprompt') as Event & {
        prompt: () => Promise<void>
        userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
      }

      Object.defineProperty(installEvent, 'prompt', {
        value: () => {
          ;(window as Window & { nutriproInstallPrompted?: boolean }).nutriproInstallPrompted = true
          return Promise.resolve()
        },
      })
      Object.defineProperty(installEvent, 'userChoice', {
        value: Promise.resolve({ outcome: 'dismissed' }),
      })
      window.dispatchEvent(installEvent)
    })

    const installButton = page.getByRole('button', { name: 'Instalar app' })
    await expect(installButton).toBeVisible()
    await installButton.click()
    await expect.poll(() => page.evaluate(() => Boolean((window as Window & { nutriproInstallPrompted?: boolean }).nutriproInstallPrompted))).toBe(true)
    await expect(installButton).toHaveCount(0)
  })

  test('orienta a instalação manual no Safari do iOS', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'userAgent', {
        configurable: true,
        get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile Safari/604.1',
      })
      Object.defineProperty(navigator, 'platform', { configurable: true, get: () => 'iPhone' })
      Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, get: () => 5 })
    })

    await page.goto('/entrar')
    const installButton = page.getByRole('button', { name: 'Instalar app' })
    await expect(installButton).toBeVisible()
    await installButton.click()

    const dialog = page.getByRole('dialog', { name: 'Instale para acessar mais rápido' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Escolha “Adicionar à Tela de Início”')).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
})
