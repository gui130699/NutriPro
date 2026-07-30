import { describe, expect, it } from 'vitest'
import {
  EXPECTED_CATALOG_TOTAL,
  REQUIRED_CSV_HEADERS,
  importCatalogCsv,
} from '../../scripts/catalog-importer'

const createRecord = (index: number, overrides: Partial<Record<(typeof REQUIRED_CSV_HEADERS)[number], string>> = {}) => {
  const record: Record<(typeof REQUIRED_CSV_HEADERS)[number], string> = {
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
  return REQUIRED_CSV_HEADERS.map((header) => record[header]).join(';')
}

const createCsv = (count: number, recordOverrides: Partial<Record<(typeof REQUIRED_CSV_HEADERS)[number], string>> = {}) => [
  REQUIRED_CSV_HEADERS.join(';'),
  ...Array.from({ length: count }, (_, index) => createRecord(index, recordOverrides)),
].join('\n')

describe('importador estrito do catalogo oficial', () => {
  it('importa exatamente 7.083 alimentos com o mapeamento publico requerido', () => {
    const result = importCatalogCsv(createCsv(EXPECTED_CATALOG_TOTAL))

    expect(result.foods).toHaveLength(EXPECTED_CATALOG_TOTAL)
    expect(result.summary).toEqual({
      importedFoods: EXPECTED_CATALOG_TOTAL,
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

  it('rejeita cabecalho diferente antes de aceitar registros', () => {
    expect(() => importCatalogCsv(`codigo;nome\n1;Food`)).toThrow('Cabeçalho CSV inválido')
  })

  it('rejeita codigos duplicados sem mesclar registros', () => {
    const csv = [REQUIRED_CSV_HEADERS.join(';'), createRecord(0), createRecord(0)].join('\n')
    expect(() => importCatalogCsv(csv)).toThrow('código duplicado')
  })

  it('rejeita codigo ou nome obrigatorio vazio', () => {
    expect(() => importCatalogCsv(createCsv(1, { codigo_usda: '   ' }))).toThrow('código do alimento obrigatório')
    expect(() => importCatalogCsv(createCsv(1, { nome_alimento_en: '   ' }))).toThrow('nome do alimento obrigatório')
  })

  it('rejeita valores nutricionais invalidos ou negativos', () => {
    expect(() => importCatalogCsv(createCsv(1, { proteinas_g_100g: 'sem dado' }))).toThrow('valor nutricional inválido')
    expect(() => importCatalogCsv(createCsv(1, { gorduras_g_100g: '-0,1' }))).toThrow('valores negativos')
  })

  it('rejeita base, unidade, idioma e total diferentes do contrato oficial', () => {
    expect(() => importCatalogCsv(createCsv(1, { quantidade_base: '90' }))).toThrow('deve ser igual a 100')
    expect(() => importCatalogCsv(createCsv(1, { unidade_base: 'ml' }))).toThrow('deve ser igual a "g"')
    expect(() => importCatalogCsv(createCsv(1, { idioma_nome: 'pt-BR' }))).toThrow('deve ser igual a "en-US"')
    expect(() => importCatalogCsv(createCsv(1))).toThrow('Total final inválido')
  })
})
