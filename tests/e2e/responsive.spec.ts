import { expect, test } from '@playwright/test'

const viewports = [
  { name: 'celular 375 × 667', width: 375, height: 667 },
  { name: 'celular 390 × 844', width: 390, height: 844 },
  { name: 'tablet 768 × 1024', width: 768, height: 1024 },
  { name: 'desktop 1366 × 768', width: 1366, height: 768 },
  { name: 'desktop 1920 × 1080', width: 1920, height: 1080 },
]

for (const viewport of viewports) {
  test(`a tela de acesso não cria rolagem horizontal em ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('/entrar')
    await expect(page.getByRole('heading', { name: 'Seu bem-estar começa aqui.' })).toBeVisible()

    await expect(page.getByRole('button', { name: 'Entrar na minha conta' })).toBeVisible()
    const layout = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }))
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewportWidth)
  })
}
