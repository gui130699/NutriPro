#!/usr/bin/env node

/**
 * Verifies the public 2.0.0-br release against both its preserved curated CSV
 * and the pinned TACO source. It is read-only and suitable for CI.
 */
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { CatalogFood } from '../src/lib/food-catalog'
import { importCatalogCsv, validateCatalogFoods } from './catalog-importer'
import {
  CURATED_DUPLICATE_SOURCE_NUMBERS,
  PRIORITY_OMISSION_SOURCE_NUMBERS,
  buildTacoCatalog,
  foodsToCsv,
  isObviousFoodDuplicate,
} from './taco-catalog'

const workspace = process.cwd()
const sourcePath = resolve(workspace, 'lista_alimentos_brasileiros_nutripro.csv')
const tacoPath = resolve(workspace, 'data/sources/taco-4a-edicao-cleaned.csv')
const foodsPath = resolve(workspace, 'public/data/foods.json')
const versionPath = resolve(workspace, 'public/data/foods-version.json')
const tacoJsonPath = resolve(workspace, 'data/generated/foods-500-taco-nutripro.json')
const tacoCsvPath = resolve(workspace, 'data/generated/lista_500_alimentos_taco_nutripro.csv')
const fullCsvPath = resolve(workspace, 'data/generated/catalogo-brasileiro-626-nutripro.csv')
const reportPath = resolve(workspace, 'docs/RELATORIO-IMPORTACAO-ALIMENTOS.md')

const brazilianRelease = {
  version: '2.0.0-br',
  updatedAt: '2026-08-01',
  totalFoods: 626,
  sourceHash: 'bc77766e56d7c669dd9cdba3fdbde7bcbf1bb4140e829720cb4a676d27670ea8',
  selectionHash: '7c3348abb6d1edcfa37e452096b47237a2906bcb32f329f6bba6072b77562189',
  idsHash: '94e93758a776bf589e5726be335f6a403ad7f477804b9e67aa4aa0a20c4cd80b',
} as const

type CatalogVersion = {
  version: string
  updatedAt: string
  totalFoods: number
}

function parseJson<T>(text: string, label: string): T {
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`${label} não contém JSON válido.`)
  }
}

function assertVersion(version: CatalogVersion): void {
  if (
    version.version !== brazilianRelease.version
    || version.updatedAt !== brazilianRelease.updatedAt
    || version.totalFoods !== brazilianRelease.totalFoods
  ) {
    throw new Error(`Versão pública inválida. Esperado ${brazilianRelease.version} / ${brazilianRelease.updatedAt} / ${brazilianRelease.totalFoods}.`)
  }
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

async function validate(): Promise<void> {
  const [source, tacoSource, foodsText, versionText, tacoJsonText, tacoCsv, fullCsv, report] = await Promise.all([
    readFile(sourcePath, 'utf8'),
    readFile(tacoPath, 'utf8'),
    readFile(foodsPath, 'utf8'),
    readFile(versionPath, 'utf8'),
    readFile(tacoJsonPath, 'utf8'),
    readFile(tacoCsvPath, 'utf8'),
    readFile(fullCsvPath, 'utf8'),
    readFile(reportPath, 'utf8'),
  ])

  const curated = importCatalogCsv(source, { expectedTotal: 126 })
  const expected = buildTacoCatalog(curated.foods, tacoSource, 500, brazilianRelease.totalFoods)
  const foods = parseJson<CatalogFood[]>(foodsText, 'public/data/foods.json')
  const tacoFoods = parseJson<CatalogFood[]>(tacoJsonText, 'data/generated/foods-500-taco-nutripro.json')
  if (!Array.isArray(foods) || !Array.isArray(tacoFoods)) throw new Error('Os JSONs gerados devem conter listas de alimentos.')
  validateCatalogFoods(foods, brazilianRelease.totalFoods)

  const version = parseJson<CatalogVersion>(versionText, 'public/data/foods-version.json')
  assertVersion(version)

  const expectedCurated = curated.foods.map((food) => ({ ...food, catalogOrigin: 'curated-br' as const, sourceFoodNumber: null }))
  if (JSON.stringify(foods.slice(0, 126)) !== JSON.stringify(expectedCurated)) {
    throw new Error('Os 126 alimentos curados foram alterados. Apenas a proveniência estrutural pode ser adicionada.')
  }
  if (JSON.stringify(foods) !== JSON.stringify(expected.foods)) {
    throw new Error('public/data/foods.json não corresponde à importação TACO reprodutível. Execute o importador novamente.')
  }
  if (JSON.stringify(tacoFoods) !== JSON.stringify(expected.tacoFoods)) {
    throw new Error('foods-500-taco-nutripro.json não corresponde à seleção TACO publicada.')
  }
  if (tacoCsv !== foodsToCsv(expected.tacoFoods) || fullCsv !== foodsToCsv(expected.foods)) {
    throw new Error('Um CSV gerado não corresponde ao catálogo JSON validado.')
  }

  const selectedCodes = expected.tacoFoods.map((food) => food.sourceFoodNumber)
  const selectedIds = expected.tacoFoods.map((food) => food.externalId)
  if (hash(selectedCodes.join(',')) !== brazilianRelease.selectionHash || hash(selectedIds.join(',')) !== brazilianRelease.idsHash) {
    throw new Error('A seleção TACO não corresponde ao manifesto determinístico da versão 2.0.0-br.')
  }
  if (hash(tacoSource) !== brazilianRelease.sourceHash) throw new Error('O hash da fonte TACO preservada não corresponde à fonte auditada.')
  if (CURATED_DUPLICATE_SOURCE_NUMBERS.size !== 80 || PRIORITY_OMISSION_SOURCE_NUMBERS.size !== 1) {
    throw new Error('A política auditada de exclusões TACO foi alterada.')
  }
  if (selectedCodes.some((code) => CURATED_DUPLICATE_SOURCE_NUMBERS.has(code) || PRIORITY_OMISSION_SOURCE_NUMBERS.has(code))) {
    throw new Error('A seleção final contém um código explicitamente excluído.')
  }
  for (const taco of expected.tacoFoods) {
    if (expectedCurated.some((food) => isObviousFoodDuplicate(food.name, taco.name))) {
      throw new Error(`Duplicidade de identidade não resolvida: ${taco.externalId}.`)
    }
  }
  if (!report.includes(brazilianRelease.sourceHash) || !report.includes(brazilianRelease.selectionHash) || !report.includes(brazilianRelease.idsHash)) {
    throw new Error('O relatório de importação não contém os checksums de auditoria.')
  }

  console.log(`Catálogo brasileiro validado: ${foods.length} alimentos (${version.version}, ${version.updatedAt}); 126 curados + 500 TACO.`)
}

validate().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
