import { describe, expect, it } from 'vitest'
import { normalizeCatalogFood } from './food-catalog'
import { searchCatalogFoods } from './food-search'

const foods = [
  normalizeCatalogFood({ externalId: '1', name: 'Pão de queijo', category: 'Padaria', calories: 360, protein: 5, carbs: 30, fat: 18, fiber: 1 }),
  normalizeCatalogFood({ externalId: '2', name: 'Queijo minas', category: 'Laticínios', brand: 'Fazenda', calories: 264, protein: 17, carbs: 3, fat: 21, fiber: 0 }),
  normalizeCatalogFood({ externalId: '3', name: 'Água de coco', category: 'Bebidas', calories: 19, protein: 0.7, carbs: 4.7, fat: 0.2, fiber: 1.1 }),
  normalizeCatalogFood({ externalId: '4', name: 'Pão integral', category: 'Padaria', calories: 250, protein: 10, carbs: 42, fat: 4, fiber: 7 }),
]

describe('pesquisa local do catálogo', () => {
  it('encontra nomes com ou sem acento e por palavra parcial', () => {
    expect(searchCatalogFoods(foods, { query: 'pão de queijo' }).foods.map((food) => food.externalId)).toContain('1')
    expect(searchCatalogFoods(foods, { query: 'pao' }).foods.map((food) => food.externalId)).toEqual(expect.arrayContaining(['1', '4']))
    expect(searchCatalogFoods(foods, { query: 'queijo' }).foods.map((food) => food.externalId)).toEqual(expect.arrayContaining(['1', '2']))
    expect(searchCatalogFoods(foods, { query: 'agua' }).foods.map((food) => food.externalId)).toEqual(['3'])
  })

  it('filtra por categoria, favoritos e itens ocultos sem varrer apenas uma página inicial', () => {
    const result = searchCatalogFoods(foods, {
      category: 'padaria',
      favoriteIds: ['4'],
      favoritesOnly: true,
      hiddenIds: ['1'],
      limit: 1,
    })

    expect(result.total).toBe(1)
    expect(result.foods.map((food) => food.externalId)).toEqual(['4'])
    expect(result.hasMore).toBe(false)
  })

  it('pagina os resultados para não renderizar toda a base de uma vez', () => {
    const firstPage = searchCatalogFoods(foods, { query: 'pao', limit: 1 })
    const secondPage = searchCatalogFoods(foods, { query: 'pao', offset: 1, limit: 1 })

    expect(firstPage.total).toBe(2)
    expect(firstPage.hasMore).toBe(true)
    expect(secondPage.foods).toHaveLength(1)
    expect(secondPage.foods[0].externalId).not.toBe(firstPage.foods[0].externalId)
  })
})
