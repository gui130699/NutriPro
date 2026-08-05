import { describe, expect, it } from 'vitest'
import { buildSearchKeywords, mergeCatalogFoods, normalizeCatalogFood, normalizeFoodName, validateFoodCatalogRelease } from './food-catalog'

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
    expect(food.baseQuantity).toBe(100)
    expect(food.measurementPolicy).toBe('mass-source')
  })

  it('preserva a política de medida da fonte sem assumir equivalência entre g e ml', () => {
    expect(normalizeCatalogFood({ externalId: 'TACO0474', name: 'Bebida TACO', category: 'Bebidas', baseUnit: 'g', catalogOrigin: 'taco' }).measurementPolicy).toBe('mass-source')
    expect(normalizeCatalogFood({ externalId: 'BR0056', name: 'Leite', category: 'Bebidas', baseUnit: 'ml', catalogOrigin: 'curated-br' }).measurementPolicy).toBe('volume-source')
    expect(normalizeCatalogFood({ externalId: 'X1', name: 'Bebida em massa', category: 'Bebidas', baseUnit: 'g' }).measurementPolicy).toBe('requires-density')
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

  it('recusa uma versão cuja contagem não coincide com o catálogo baixado', () => {
    const foods = mergeCatalogFoods([], [
      { externalId: 'BR0001', name: 'Arroz integral', calories: 124, protein: 2.6, carbs: 25.8, fat: 1, fiber: 2.7 },
    ])

    expect(() => validateFoodCatalogRelease(foods, {
      version: '1.0.0-br',
      updatedAt: '2026-07-31',
      totalFoods: 126,
    })).toThrow('catálogo baixado está incompleto')
  })

  it('recusa códigos duplicados antes de gravar a versão no cache', () => {
    const food = normalizeCatalogFood({ externalId: 'BR0001', name: 'Arroz', calories: 1 })
    expect(() => validateFoodCatalogRelease([food, food], {
      version: '1.0.0-br',
      updatedAt: '2026-07-31',
      totalFoods: 2,
    })).toThrow('códigos duplicados')
  })
})
