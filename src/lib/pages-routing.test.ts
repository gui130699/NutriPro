import { describe, expect, it } from 'vitest'
import { restoredPagesRoute } from './pages-routing'

describe('restoredPagesRoute', () => {
  it('recompõe uma rota do GitHub Pages sob a base do repositório', () => {
    expect(restoredPagesRoute('?p=%2Fentrar%3Fsource%3Datalho', '/NutriPro/')).toBe('/NutriPro/entrar?source=atalho')
  })

  it('mantém a rota válida quando a aplicação usa a base raiz', () => {
    expect(restoredPagesRoute('?p=%2Fevolucao', '/')).toBe('/evolucao')
  })

  it('ignora valores ausentes ou que poderiam apontar para outra origem', () => {
    expect(restoredPagesRoute('', '/NutriPro/')).toBeNull()
    expect(restoredPagesRoute('?p=%2F%2Fevil.example', '/NutriPro/')).toBeNull()
    expect(restoredPagesRoute('?p=https%3A%2F%2Fevil.example', '/NutriPro/')).toBeNull()
  })
})
