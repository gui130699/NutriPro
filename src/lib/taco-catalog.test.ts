import { describe, expect, it } from 'vitest'
import {
  CURATED_DUPLICATE_SOURCE_NUMBERS,
  PRIORITY_OMISSION_SOURCE_NUMBERS,
  buildTacoCatalog,
  isObviousFoodDuplicate,
  normalizeFoodIdentity,
  parseTacoCsv,
  parseTacoNumber,
} from '../../scripts/taco-catalog'

const sampleTacoCsv = `Numero do Alimento,Grupo,Descrição dos Alimentos,Energia (kcal),Proteína (g),Lipídeos (g),Carboidrato (g),Fibra Alimentar (g),Sódio (mg)
2,Cereais e derivados,Arroz especial cozido,120,"2,5","0,3","25,2","1,1",1
`

const curatedFood = {
  externalId: 'BR0001', name: 'Arroz integral cozido', nameNormalized: 'arroz integral cozido', searchKeywords: ['arroz'],
  category: 'Cereais e derivados', brand: null, calories: 124, protein: 2.6, carbs: 25.8, fat: 1, fiber: 2.7,
  baseQuantity: 100, baseUnit: 'g' as const, unitWeightG: null, portionWeightG: null, source: 'TACO', language: 'pt-BR', isActive: true,
  measurementPolicy: 'mass-source' as const,
}

describe('importação TACO 4ª edição', () => {
  it('converte decimais e valores ausentes sem inventar macronutrientes obrigatórios', () => {
    expect(parseTacoNumber('1,25')).toBe(1.25)
    expect(parseTacoNumber('Tr')).toBe(0.00001)
    expect(parseTacoNumber('NA')).toBeNull()
    expect(parseTacoNumber('*')).toBeNull()
    expect(parseTacoNumber('')).toBeNull()
  })

  it('normaliza identidade sem misturar preparos ou variantes materiais', () => {
    expect(normalizeFoodIdentity('Peito de frango, grelhado sem pele')).toBe(normalizeFoodIdentity('Frango, peito, sem pele, grelhado'))
    expect(isObviousFoodDuplicate('Frango, peito, sem pele, grelhado', 'Peito de frango grelhado sem pele')).toBe(true)
    expect(isObviousFoodDuplicate('Frango, peito, sem pele, cru', 'Frango, peito, sem pele, grelhado')).toBe(false)
    expect(isObviousFoodDuplicate('Biscoito wafer recheado de chocolate', 'Biscoito wafer recheado de morango')).toBe(false)
    expect(isObviousFoodDuplicate('Manteiga com sal', 'Manteiga sem sal')).toBe(false)
  })

  it('constrói uma seleção determinística com IDs e origem TACO', () => {
    const parsed = parseTacoCsv(sampleTacoCsv)
    const release = buildTacoCatalog([curatedFood], sampleTacoCsv, 1, 2)

    expect(parsed.sourceRows).toBe(1)
    expect(parsed.records).toHaveLength(1)
    expect(parsed.skipped).toHaveLength(0)
    expect(CURATED_DUPLICATE_SOURCE_NUMBERS.size).toBe(80)
    expect(PRIORITY_OMISSION_SOURCE_NUMBERS).toEqual(new Set([474]))
    expect(release.foods).toHaveLength(2)
    expect(release.tacoFoods).toHaveLength(1)
    expect(release.summary.duplicateWithCurated).toBe(0)
    expect(release.summary.duplicateWithinTaco).toBe(0)
    expect(release.summary.priorityOmissions).toBe(0)
    expect(release.tacoFoods[0]?.externalId).toBe('TACO0002')
    expect(release.tacoFoods.every((food) => food.catalogOrigin === 'taco' && food.sourceFoodNumber && food.baseQuantity === 100 && food.baseUnit === 'g')).toBe(true)
  })
})
