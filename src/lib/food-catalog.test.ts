import { describe, expect, it } from 'vitest'
import { buildSearchKeywords, mergeCatalogFoods, normalizeCatalogFood, normalizeFoodName } from './food-catalog'

describe('catálogo público de alimentos', () => {
  it('normaliza nomes sem acentos, pontuação ou espaços duplicados', () => {
    expect(normalizeFoodName('  Pão  de queijo — CASEIRO!  ')).toBe('pao de queijo caseiro')

    const food = normalizeCatalogFood({
      codigo: 'BR-001',
      nome: 'Pão de queijo',
      categoria: 'Padaria',
      proteinas: '5,4',
      carboidratos: '31,0',
      gorduras: '18,2',
      fibras: '1,0',
      calorias: '363',
    })

    expect(food.nameNormalized).toBe('pao de queijo')
    expect(food.searchKeywords).toEqual(expect.arrayContaining(['pao de queijo', 'pao', 'queijo', 'padaria']))
    expect(food.protein).toBe(5.4)
  })

  it('cria palavras-chave pesquisáveis a partir do nome, categoria e marca', () => {
    expect(buildSearchKeywords('Iogurte natural', 'Laticínios', 'NutriPro')).toEqual(expect.arrayContaining([
      'iogurte natural',
      'iogurte',
      'laticinios',
      'nutripro',
    ]))
  })

  it('mescla pelo código externo sem duplicar em importações repetidas', () => {
    const imported = [
      { externalId: '42', name: 'Banana', calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3, fiber: 2.6 },
      { externalId: '42', name: 'Banana-prata', calories: 98, protein: 1.3, carbs: 26, fat: 0.2, fiber: 2 },
      { externalId: '43', name: 'Maçã', calories: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4 },
    ]

    const firstImport = mergeCatalogFoods([], imported)
    const repeatedImport = mergeCatalogFoods(firstImport, imported)

    expect(firstImport).toHaveLength(2)
    expect(firstImport.find((food) => food.externalId === '42')?.name).toBe('Banana-prata')
    expect(repeatedImport).toEqual(firstImport)
  })
})
