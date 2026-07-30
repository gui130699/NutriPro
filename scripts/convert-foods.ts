#!/usr/bin/env node

/**
 * Imports the official 7,083-food CSV only after the entire source has passed
 * validation. This ordering guarantees that a missing or malformed CSV never
 * replaces a previously generated catalogue.
 *
 * Usage:
 *   npm run catalog:import -- lista_7083_alimentos_nutrientes_100g.csv --version 1.0.0
 */
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, resolve } from 'node:path'
import { EXPECTED_CATALOG_TOTAL, importCatalogCsv } from './catalog-importer'

const workspace = process.cwd()
const defaultSource = resolve(workspace, 'lista_7083_alimentos_nutrientes_100g.csv')
const defaultOutput = resolve(workspace, 'public/data/foods.json')
const defaultVersionOutput = resolve(workspace, 'public/data/foods-version.json')

type ImportOptions = {
  source: string
  output: string
  versionOutput: string
  version: string
  updatedAt: string
}

function parseArguments(argumentsList: string[]): ImportOptions {
  const options: ImportOptions = {
    source: defaultSource,
    output: defaultOutput,
    versionOutput: defaultVersionOutput,
    version: '1.0.0',
    updatedAt: new Date().toISOString().slice(0, 10),
  }
  let sourceProvided = false

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index]
    const value = argumentsList[index + 1]
    if (!argument.startsWith('--')) {
      if (sourceProvided) throw new Error(`Argumento inesperado: ${argument}.`)
      options.source = resolve(workspace, argument)
      sourceProvided = true
    } else if (argument === '--out') {
      if (!value || value.startsWith('--')) throw new Error('Informe o caminho após --out.')
      options.output = resolve(workspace, value)
      index += 1
    } else if (argument === '--version-out') {
      if (!value || value.startsWith('--')) throw new Error('Informe o caminho após --version-out.')
      options.versionOutput = resolve(workspace, value)
      index += 1
    } else if (argument === '--version') {
      if (!value || value.startsWith('--')) throw new Error('Informe a versão após --version.')
      options.version = value
      index += 1
    } else if (argument === '--updated-at') {
      if (!value || value.startsWith('--')) throw new Error('Informe a data após --updated-at.')
      options.updatedAt = value
      index += 1
    } else if (argument === '--help' || argument === '-h') {
      console.log('Uso: npm run catalog:import -- lista_7083_alimentos_nutrientes_100g.csv --version 1.0.0')
      process.exit(0)
    } else {
      throw new Error(`Opção desconhecida: ${argument}.`)
    }
  }
  return options
}

async function readSource(source: string): Promise<string> {
  try {
    return await readFile(source, 'utf8')
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      throw new Error(`CSV não encontrado: ${source}. Nenhum catálogo existente foi alterado.`)
    }
    throw error
  }
}

/** Writes fully prepared files through temporary siblings after source validation succeeds. */
async function writeOutputs(options: ImportOptions, foodsJson: string, versionJson: string): Promise<void> {
  await Promise.all([
    mkdir(dirname(options.output), { recursive: true }),
    mkdir(dirname(options.versionOutput), { recursive: true }),
  ])

  const suffix = `.tmp-${process.pid}-${Date.now()}`
  const foodsTemporary = `${options.output}${suffix}`
  const versionTemporary = `${options.versionOutput}${suffix}`
  try {
    await Promise.all([
      writeFile(foodsTemporary, foodsJson, 'utf8'),
      writeFile(versionTemporary, versionJson, 'utf8'),
    ])
    await rename(foodsTemporary, options.output)
    await rename(versionTemporary, options.versionOutput)
  } finally {
    await Promise.all([
      rm(foodsTemporary, { force: true }),
      rm(versionTemporary, { force: true }),
    ])
  }
}

async function convert(options: ImportOptions): Promise<void> {
  if (extname(options.source).toLocaleLowerCase('pt-BR') !== '.csv') {
    throw new Error('Use o arquivo CSV oficial lista_7083_alimentos_nutrientes_100g.csv.')
  }

  const source = await readSource(options.source)
  const result = importCatalogCsv(source)
  const foodsJson = `${JSON.stringify(result.foods)}\n`
  const versionJson = `${JSON.stringify({
    version: options.version,
    updatedAt: options.updatedAt,
    totalFoods: result.foods.length,
  }, null, 2)}\n`

  // The source and generated data are complete at this point; no write occurs before it.
  await writeOutputs(options, foodsJson, versionJson)

  console.log(`Alimentos importados: ${result.summary.importedFoods.toLocaleString('pt-BR')}`)
  console.log(`Códigos duplicados: ${result.summary.duplicateCodes}`)
  console.log(`Registros ignorados: ${result.summary.ignoredRecords}`)
  console.log(`Registros inválidos: ${result.summary.invalidRecords}`)
  console.log('Catálogo gerado com sucesso')
  console.log(`Fonte: ${basename(options.source)} | versão: ${options.version} | esperado: ${EXPECTED_CATALOG_TOTAL}`)
}

convert(parseArguments(process.argv.slice(2))).catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
