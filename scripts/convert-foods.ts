#!/usr/bin/env node

/**
 * Imports the curated NutriPro CSV and, optionally, appends a deterministic
 * selection from TACO. All output files are prepared before their final names
 * are replaced, so an invalid source never partially publishes a catalogue.
 *
 * Examples:
 *   npm run catalog:import -- lista_alimentos_brasileiros_nutripro.csv --version 1.0.0-br --expected-total 126
 *   npm run catalog:import -- lista_alimentos_brasileiros_nutripro.csv --taco data/sources/taco-4a-edicao-cleaned.csv --additional-total 500 --expected-total 626 --version 2.0.0-br
 */
import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, resolve } from 'node:path'
import { assertExpectedTotal, importCatalogCsv } from './catalog-importer'
import { buildTacoCatalog, foodsToCsv, importReportMarkdown } from './taco-catalog'

const workspace = process.cwd()
const defaultSource = resolve(workspace, 'lista_alimentos_brasileiros_nutripro.csv')
const defaultOutput = resolve(workspace, 'public/data/foods.json')
const defaultVersionOutput = resolve(workspace, 'public/data/foods-version.json')

type ImportOptions = {
  source: string
  tacoSource?: string
  output: string
  versionOutput: string
  version: string
  updatedAt: string
  expectedTotal: number
  additionalTotal?: number
}

type OutputFile = { path: string; content: string }

function parseExpectedTotal(value: string, argument = '--expected-total'): number {
  if (!/^\d+$/.test(value)) throw new Error(`Informe um inteiro positivo após ${argument}.`)
  const expectedTotal = Number(value)
  assertExpectedTotal(expectedTotal)
  return expectedTotal
}

function parseArguments(argumentsList: string[]): ImportOptions {
  const options: Omit<ImportOptions, 'expectedTotal'> & { expectedTotal?: number } = {
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
    } else if (argument === '--expected-total') {
      if (!value || value.startsWith('--')) throw new Error('Informe o total esperado após --expected-total.')
      options.expectedTotal = parseExpectedTotal(value)
      index += 1
    } else if (argument === '--taco') {
      if (!value || value.startsWith('--')) throw new Error('Informe o caminho CSV após --taco.')
      options.tacoSource = resolve(workspace, value)
      index += 1
    } else if (argument === '--additional-total') {
      if (!value || value.startsWith('--')) throw new Error('Informe o total adicional após --additional-total.')
      options.additionalTotal = parseExpectedTotal(value, '--additional-total')
      index += 1
    } else if (argument === '--help' || argument === '-h') {
      console.log('Uso: npm run catalog:import -- lista_alimentos_brasileiros_nutripro.csv --taco data/sources/taco-4a-edicao-cleaned.csv --additional-total 500 --expected-total 626 --version 2.0.0-br')
      process.exit(0)
    } else {
      throw new Error(`Opção desconhecida: ${argument}.`)
    }
  }

  if (options.expectedTotal === undefined) throw new Error('O parâmetro --expected-total é obrigatório para importar um catálogo.')
  if (Boolean(options.tacoSource) !== Boolean(options.additionalTotal)) {
    throw new Error('Use --taco e --additional-total juntos.')
  }
  return options as ImportOptions
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

/** Writes all prepared assets through temporary siblings before publishing them. */
async function writeOutputs(outputs: readonly OutputFile[]): Promise<void> {
  const suffix = `.tmp-${process.pid}-${Date.now()}`
  const temporary = outputs.map((output) => ({ ...output, temporaryPath: `${output.path}${suffix}` }))
  await Promise.all(outputs.map((output) => mkdir(dirname(output.path), { recursive: true })))
  try {
    await Promise.all(temporary.map((output) => writeFile(output.temporaryPath, output.content, 'utf8')))
    for (const output of temporary) await rename(output.temporaryPath, output.path)
  } finally {
    await Promise.all(temporary.map((output) => rm(output.temporaryPath, { force: true })))
  }
}

async function convert(options: ImportOptions): Promise<void> {
  if (extname(options.source).toLocaleLowerCase('pt-BR') !== '.csv') throw new Error('Use um arquivo CSV como fonte do catálogo.')
  if (options.tacoSource && extname(options.tacoSource).toLocaleLowerCase('pt-BR') !== '.csv') throw new Error('Use um arquivo CSV como fonte TACO.')

  const curatedSource = await readSource(options.source)
  const curatedExpected = options.additionalTotal ? options.expectedTotal - options.additionalTotal : options.expectedTotal
  const curated = importCatalogCsv(curatedSource, { expectedTotal: curatedExpected })

  if (!options.tacoSource || !options.additionalTotal) {
    const foodsJson = `${JSON.stringify(curated.foods)}\n`
    const versionJson = `${JSON.stringify({ version: options.version, updatedAt: options.updatedAt, totalFoods: curated.foods.length }, null, 2)}\n`
    await writeOutputs([{ path: options.output, content: foodsJson }, { path: options.versionOutput, content: versionJson }])
    console.log(`Alimentos importados: ${curated.summary.importedFoods.toLocaleString('pt-BR')}`)
    console.log('Catálogo gerado com sucesso')
    console.log(`Fonte: ${basename(options.source)} | versão: ${options.version} | esperado: ${options.expectedTotal}`)
    return
  }

  const tacoSource = await readSource(options.tacoSource)
  const release = buildTacoCatalog(curated.foods, tacoSource, options.additionalTotal, options.expectedTotal)
  const sourceHash = createHash('sha256').update(tacoSource).digest('hex')
  const selectionHash = createHash('sha256').update(release.tacoFoods.map((food) => food.sourceFoodNumber).join(',')).digest('hex')
  const idsHash = createHash('sha256').update(release.tacoFoods.map((food) => food.externalId).join(',')).digest('hex')
  const foodsJson = `${JSON.stringify(release.foods)}\n`
  const tacoJson = `${JSON.stringify(release.tacoFoods, null, 2)}\n`
  const versionJson = `${JSON.stringify({ version: options.version, updatedAt: options.updatedAt, totalFoods: release.foods.length }, null, 2)}\n`
  const generatedDirectory = resolve(workspace, 'data/generated')
  const reportPath = resolve(workspace, 'docs/RELATORIO-IMPORTACAO-ALIMENTOS.md')
  await writeOutputs([
    { path: options.output, content: foodsJson },
    { path: options.versionOutput, content: versionJson },
    { path: resolve(generatedDirectory, 'lista_500_alimentos_taco_nutripro.csv'), content: foodsToCsv(release.tacoFoods) },
    { path: resolve(generatedDirectory, 'foods-500-taco-nutripro.json'), content: tacoJson },
    { path: resolve(generatedDirectory, 'catalogo-brasileiro-626-nutripro.csv'), content: foodsToCsv(release.foods) },
    { path: reportPath, content: importReportMarkdown(release.summary, sourceHash, selectionHash, idsHash) },
  ])
  console.log(`Alimentos curados preservados: ${curated.foods.length}`)
  console.log(`Novos alimentos TACO: ${release.tacoFoods.length}`)
  console.log(`Total final: ${release.foods.length}`)
  console.log(`Duplicidades com curados: ${release.summary.duplicateWithCurated}`)
  console.log(`Duplicidades TACO internas: ${release.summary.duplicateWithinTaco}`)
  console.log(`Registros ignorados/inválidos: ${release.summary.skipped.length}`)
  console.log(`Fonte: ${basename(options.tacoSource)} | SHA-256: ${sourceHash} | versão: ${options.version}`)
}

convert(parseArguments(process.argv.slice(2))).catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
