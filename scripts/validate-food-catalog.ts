#!/usr/bin/env node

/**
 * Verifies that the published Brazilian catalog is the exact output of its
 * editable CSV source. It is intentionally read-only so it can run in CI
 * before a release or after regenerating public/data/foods.json.
 *
 * Run with: npx tsx scripts/validate-food-catalog.ts
 */
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { CatalogFood } from '../src/lib/food-catalog'
import { importCatalogCsv, validateCatalogFoods } from './catalog-importer'

const workspace = process.cwd()
const sourcePath = resolve(workspace, 'lista_alimentos_brasileiros_nutripro.csv')
const foodsPath = resolve(workspace, 'public/data/foods.json')
const versionPath = resolve(workspace, 'public/data/foods-version.json')

const brazilianRelease = {
  version: '1.0.0-br',
  updatedAt: '2026-07-31',
  totalFoods: 126,
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
    throw new Error(
      `Versão pública inválida. Esperado ${brazilianRelease.version} / ${brazilianRelease.updatedAt} / ${brazilianRelease.totalFoods}.`,
    )
  }
}

async function validate(): Promise<void> {
  const [source, foodsText, versionText] = await Promise.all([
    readFile(sourcePath, 'utf8'),
    readFile(foodsPath, 'utf8'),
    readFile(versionPath, 'utf8'),
  ])

  const imported = importCatalogCsv(source, { expectedTotal: brazilianRelease.totalFoods })
  const foods = parseJson<CatalogFood[]>(foodsText, 'public/data/foods.json')
  if (!Array.isArray(foods)) throw new Error('public/data/foods.json deve conter uma lista de alimentos.')
  validateCatalogFoods(foods, brazilianRelease.totalFoods)

  const version = parseJson<CatalogVersion>(versionText, 'public/data/foods-version.json')
  assertVersion(version)

  if (JSON.stringify(foods) !== JSON.stringify(imported.foods)) {
    throw new Error('public/data/foods.json não corresponde exatamente ao CSV brasileiro canônico. Execute o importador novamente.')
  }

  if (foods[0]?.externalId !== 'BR0001' || foods.at(-1)?.externalId !== 'BR0126') {
    throw new Error('O catálogo brasileiro deve iniciar em BR0001 e terminar em BR0126.')
  }

  console.log(`Catálogo brasileiro validado: ${foods.length} alimentos (${version.version}, ${version.updatedAt}).`)
}

validate().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
