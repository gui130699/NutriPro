import { describe, expect, it } from 'vitest'
import {
  BRAZILIAN_CSV_HEADERS,
  INTERNATIONAL_CSV_HEADERS,
  importCatalogCsv,
} from '../../scripts/catalog-importer'

type InternationalField = (typeof INTERNATIONAL_CSV_HEADERS)[number]
type BrazilianField = (typeof BRAZILIAN_CSV_HEADERS)[number]

const joinCsv = (headers: readonly string[], records: string[]) => [headers.join(';'), ...records].join('\n')

const createInternationalRecord = (
  index: number,
  overrides: Partial<Record<InternationalField, string>> = {},
) => {
  const record: Record<InternationalField, string> = {
    codigo_usda: `USDA-${index + 1}`,
    nome_alimento_en: `Food ${index + 1}`,
    categoria_en: 'Vegetables',
    proteinas_g_100g: '1,5',
    carboidratos_g_100g: '2.5',
    fibras_g_100g: '0',
    gorduras_g_100g: '0.5',
    calorias_estimadas_kcal_100g: '20',
    quantidade_base: '100',
    unidade_base: 'g',
    idioma_nome: 'en-US',
    ativo: index % 2 === 0 ? 'S' : 'N',
    fonte_url: 'https://fdc.nal.usda.gov/',
    ...overrides,
  }

  return INTERNATIONAL_CSV_HEADERS.map((header) => record[header]).join(';')
}

const createBrazilianRecord = (
  index: number,
  overrides: Partial<Record<BrazilianField, string>> = {},
) => {
  const record: Record<BrazilianField, string> = {
    codigo_alimento: `BR${String(index + 1).padStart(4, '0')}`,
    nome_alimento_pt_br: `Bebida típica ${index + 1}`,
    categoria_pt_br: 'Bebidas e infusões',
    marca: 'NutriPro',
    calorias_kcal_100: '18',
    proteinas_g_100: '0',
    carboidratos_g_100: '4,2',
    gorduras_g_100: '0',
    fibras_g_100: '0',
    quantidade_base: '100',
    unidade_base: 'ml',
    peso_medio_unidade_g: '250',
    peso_porcao_g: '200',
    idioma_nome: 'pt-BR',
    ativo: index % 2 === 0 ? 'S' : 'N',
    fonte: 'Tabela própria',
    ...overrides,
  }

  return BRAZILIAN_CSV_HEADERS.map((header) => record[header]).join(';')
}

describe('importador estrito do catálogo oficial', () => {
  it('importa o contrato internacional em gramas', () => {
    const csv = joinCsv(INTERNATIONAL_CSV_HEADERS, [
      createInternationalRecord(0),
      createInternationalRecord(1),
    ])

    const result = importCatalogCsv(csv, { expectedTotal: 2 })

    expect(result.summary).toEqual({
      importedFoods: 2,
      duplicateCodes: 0,
      ignoredRecords: 0,
      invalidRecords: 0,
    })
    expect(result.foods[0]).toMatchObject({
      externalId: 'USDA-1',
      name: 'Food 1',
      category: 'Vegetables',
      protein: 1.5,
      carbs: 2.5,
      fiber: 0,
      fat: 0.5,
      calories: 20,
      baseQuantity: 100,
      baseUnit: 'g',
      language: 'en-US',
      isActive: true,
    })
    expect(result.foods[1]?.isActive).toBe(false)
  })

  it('importa o contrato brasileiro em mililitros, com marca e pesos opcionais', () => {
    const csv = joinCsv(BRAZILIAN_CSV_HEADERS, [
      createBrazilianRecord(0, { fonte: '"Valor médio; conferir rótulo"' }),
    ])

    const result = importCatalogCsv(csv, { expectedTotal: 1 })

    expect(result.foods[0]).toMatchObject({
      externalId: 'BR0001',
      name: 'Bebida típica 1',
      nameNormalized: 'bebida tipica 1',
      category: 'Bebidas e infusões',
      brand: 'NutriPro',
      carbs: 4.2,
      baseUnit: 'ml',
      unitWeightG: 250,
      portionWeightG: 200,
      source: 'Valor médio; conferir rótulo',
      language: 'pt-BR',
      isActive: true,
    })
    expect(result.foods[0]?.searchKeywords).toEqual(expect.arrayContaining([
      'bebida tipica 1',
      'bebidas e infusoes',
      'nutripro',
    ]))
  })

  it('rejeita cabeçalho diferente e CSV com aspas não fechadas', () => {
    expect(() => importCatalogCsv('codigo;nome\n1;Food', { expectedTotal: 1 })).toThrow('Cabeçalho CSV inválido')

    const malformed = joinCsv(BRAZILIAN_CSV_HEADERS, [
      createBrazilianRecord(0, { fonte: '"fonte sem fechamento' }),
    ])
    expect(() => importCatalogCsv(malformed, { expectedTotal: 1 })).toThrow('aspas não fechadas')
  })

  it('rejeita códigos duplicados e total divergente sem aceitar importação parcial', () => {
    const duplicate = joinCsv(BRAZILIAN_CSV_HEADERS, [
      createBrazilianRecord(0),
      createBrazilianRecord(0),
    ])
    expect(() => importCatalogCsv(duplicate, { expectedTotal: 2 })).toThrow('código duplicado')

    const oneRecord = joinCsv(INTERNATIONAL_CSV_HEADERS, [createInternationalRecord(0)])
    expect(() => importCatalogCsv(oneRecord, { expectedTotal: 2 })).toThrow('Total final inválido')
  })

  it('rejeita valores obrigatórios, negativos e incompatíveis com o contrato', () => {
    const emptyCode = joinCsv(INTERNATIONAL_CSV_HEADERS, [createInternationalRecord(0, { codigo_usda: '   ' })])
    expect(() => importCatalogCsv(emptyCode, { expectedTotal: 1 })).toThrow('código do alimento obrigatório')

    const negativeCalories = joinCsv(BRAZILIAN_CSV_HEADERS, [createBrazilianRecord(0, { calorias_kcal_100: '-1' })])
    expect(() => importCatalogCsv(negativeCalories, { expectedTotal: 1 })).toThrow('valores negativos')

    const wrongLocale = joinCsv(BRAZILIAN_CSV_HEADERS, [createBrazilianRecord(0, { idioma_nome: 'en-US' })])
    expect(() => importCatalogCsv(wrongLocale, { expectedTotal: 1 })).toThrow('deve ser igual a "pt-BR"')
  })
})
