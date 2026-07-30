#!/usr/bin/env node

/**
 * Converts the supplied public food CSV into the compact runtime catalogue.
 *
 * Usage:
 *   node scripts/convert-foods.ts lista_7083_alimentos_nutrientes_100g.csv --version 1.0.0
 *
 * Node 22+ can execute this file directly because it intentionally uses only
 * JavaScript syntax despite the `.ts` extension. This keeps the project free of
 * an extra runtime dependency just for an occasional data conversion.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, resolve } from 'node:path'

const workspace = process.cwd()
const defaultSource = resolve(workspace, 'lista_7083_alimentos_nutrientes_100g.csv')
const defaultOutput = resolve(workspace, 'public/data/foods.json')
const defaultVersionOutput = resolve(workspace, 'public/data/foods-version.json')

const compact = (value) => normalize(value).replace(/\s/g, '')

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function cleanText(value) {
  const text = String(value ?? '').trim().replace(/\s+/g, ' ')
  return text || null
}

function numberValue(value, fallback = 0) {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.max(0, value) : fallback

  const text = String(value ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace(/[^0-9,.-]/g, '')
  if (!text) return fallback

  const comma = text.lastIndexOf(',')
  const dot = text.lastIndexOf('.')
  const normalized = comma > dot
    ? text.replace(/\./g, '').replace(',', '.')
    : text.replace(/,/g, '')
  const result = Number(normalized)
  return Number.isFinite(result) ? Math.max(0, result) : fallback
}

function optionalNumber(value) {
  return String(value ?? '').trim() === '' ? undefined : numberValue(value)
}

function baseUnit(value) {
  const unit = normalize(value)
  return unit === 'ml' || unit === 'l' || unit.includes('mililit') || unit.includes('millilit') || unit.includes('litro')
    ? 'ml'
    : 'g'
}

function isActive(value) {
  const state = normalize(value)
  return !new Set(['0', 'false', 'inativo', 'inactive', 'nao', 'não', 'no']).has(state)
}

function searchKeywords(name, category, brand) {
  const phrases = [name, category, brand].map(normalize).filter(Boolean)
  return [...new Set([...phrases, ...phrases.flatMap((phrase) => phrase.split(' ').filter(Boolean))])]
}

/** A quote-aware parser; CSVs exported from Excel commonly use semicolons and decimal commas. */
function parseCsv(text, delimiter) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    const next = text[index + 1]

    if (quoted) {
      if (character === '"' && next === '"') {
        field += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        field += character
      }
      continue
    }

    if (character === '"') {
      quoted = true
    } else if (character === delimiter) {
      row.push(field)
      field = ''
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && next === '\n') index += 1
      row.push(field)
      if (row.some((value) => value.trim() !== '')) rows.push(row)
      row = []
      field = ''
    } else {
      field += character
    }
  }

  row.push(field)
  if (row.some((value) => value.trim() !== '')) rows.push(row)
  return rows
}

function detectDelimiter(text) {
  const firstLine = text.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] ?? ''
  const candidates = [';', ',', '\t']
  return candidates.reduce((best, candidate) => {
    const count = firstLine.split(candidate).length - 1
    const bestCount = firstLine.split(best).length - 1
    return count > bestCount ? candidate : best
  }, ';')
}

function findColumn(headers, aliases) {
  const normalizedHeaders = headers.map(compact)
  const normalizedAliases = aliases.map(compact)
  for (const alias of normalizedAliases) {
    const exact = normalizedHeaders.indexOf(alias)
    if (exact >= 0) return exact
  }

  for (const alias of normalizedAliases.filter((value) => value.length > 3)) {
    const partial = normalizedHeaders.findIndex((header) => header.includes(alias))
    if (partial >= 0) return partial
  }
  return -1
}

function buildColumns(headers) {
  return {
    externalId: findColumn(headers, ['externalId', 'external id', 'codigo original do alimento', 'codigo do alimento', 'codigo alimento', 'codigo', 'código', 'food code', 'food id', 'id alimento', 'id']),
    name: findColumn(headers, ['name', 'nome do alimento', 'nome alimento', 'nome', 'food name', 'alimento']),
    category: findColumn(headers, ['category', 'categoria', 'grupo alimentar', 'grupo', 'food category']),
    brand: findColumn(headers, ['brand', 'marca']),
    calories: findColumn(headers, ['calories per 100 g', 'calorias por 100 g', 'calorias 100g', 'calorias', 'energia kcal', 'energy kcal', 'kcal']),
    protein: findColumn(headers, ['protein per 100 g', 'proteinas por 100 g', 'proteina por 100 g', 'proteinas', 'proteínas', 'proteina', 'protein']),
    carbs: findColumn(headers, ['carbs per 100 g', 'carboidratos por 100 g', 'carboidratos', 'carboidrato', 'carbohydrates', 'carbs']),
    fat: findColumn(headers, ['fat per 100 g', 'gorduras por 100 g', 'gordura por 100 g', 'gorduras', 'gordura', 'fat', 'lipidios', 'lipídios']),
    fiber: findColumn(headers, ['fiber per 100 g', 'fibras por 100 g', 'fibra por 100 g', 'fibras', 'fibra', 'fiber', 'fibre']),
    saturatedFat: findColumn(headers, ['saturated fat', 'gorduras saturadas', 'gordura saturada']),
    sugar: findColumn(headers, ['sugars', 'sugar', 'acucares', 'açúcares', 'acucar', 'açúcar']),
    sodium: findColumn(headers, ['sodium', 'sodio', 'sódio']),
    baseUnit: findColumn(headers, ['base unit', 'unidade base', 'unidade-base', 'unit']),
    unitWeightG: findColumn(headers, ['unit weight g', 'peso medio unidade', 'peso médio unidade', 'peso da unidade', 'peso unidade']),
    portionWeightG: findColumn(headers, ['portion weight g', 'peso porcao', 'peso porção', 'peso da porcao', 'peso da porção']),
    source: findColumn(headers, ['source', 'fonte']),
    language: findColumn(headers, ['name language', 'idioma do nome', 'idioma', 'language']),
    isActive: findColumn(headers, ['is active', 'ativo', 'status', 'estado']),
  }
}

function column(row, columns, name) {
  const index = columns[name]
  return index >= 0 ? row[index] ?? '' : ''
}

function makeFood(row, columns) {
  const externalId = cleanText(column(row, columns, 'externalId'))
  const name = cleanText(column(row, columns, 'name'))
  if (!externalId || !name) return null

  const category = cleanText(column(row, columns, 'category'))
  const brand = cleanText(column(row, columns, 'brand'))
  const food = {
    externalId,
    name,
    nameNormalized: normalize(name),
    searchKeywords: searchKeywords(name, category, brand),
    category,
    brand,
    calories: numberValue(column(row, columns, 'calories')),
    protein: numberValue(column(row, columns, 'protein')),
    carbs: numberValue(column(row, columns, 'carbs')),
    fat: numberValue(column(row, columns, 'fat')),
    fiber: numberValue(column(row, columns, 'fiber')),
    baseUnit: baseUnit(column(row, columns, 'baseUnit')),
    unitWeightG: optionalNumber(column(row, columns, 'unitWeightG')) ?? null,
    portionWeightG: optionalNumber(column(row, columns, 'portionWeightG')) ?? null,
    source: cleanText(column(row, columns, 'source')),
    language: cleanText(column(row, columns, 'language')),
    isActive: isActive(column(row, columns, 'isActive')),
  }

  const saturatedFat = optionalNumber(column(row, columns, 'saturatedFat'))
  const sugar = optionalNumber(column(row, columns, 'sugar'))
  const sodium = optionalNumber(column(row, columns, 'sodium'))
  if (saturatedFat !== undefined) food.saturatedFat = saturatedFat
  if (sugar !== undefined) food.sugar = sugar
  if (sodium !== undefined) food.sodium = sodium
  return food
}

function parseArguments(argumentsList) {
  const options = {
    source: defaultSource,
    output: defaultOutput,
    versionOutput: defaultVersionOutput,
    version: '1.0.0',
    updatedAt: new Date().toISOString().slice(0, 10),
  }

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index]
    const value = argumentsList[index + 1]
    if (!argument.startsWith('--') && index === 0) {
      options.source = resolve(workspace, argument)
    } else if (argument === '--out' && value) {
      options.output = resolve(workspace, value)
      index += 1
    } else if (argument === '--version-out' && value) {
      options.versionOutput = resolve(workspace, value)
      index += 1
    } else if (argument === '--version' && value) {
      options.version = value
      index += 1
    } else if (argument === '--updated-at' && value) {
      options.updatedAt = value
      index += 1
    } else if (argument === '--help' || argument === '-h') {
      console.log('Uso: node scripts/convert-foods.ts [arquivo.csv] [--version 1.0.0] [--out public/data/foods.json]')
      process.exit(0)
    }
  }
  return options
}

async function readExistingFoods(output) {
  try {
    const current = JSON.parse(await readFile(output, 'utf8'))
    return Array.isArray(current) && current.length > 0
  } catch {
    return false
  }
}

async function writeStub(options) {
  const hasExistingFoods = await readExistingFoods(options.output)
  if (hasExistingFoods) {
    console.warn(`CSV não encontrado; o catálogo existente em ${options.output} foi preservado.`)
    return
  }

  await mkdir(dirname(options.output), { recursive: true })
  await mkdir(dirname(options.versionOutput), { recursive: true })
  await writeFile(options.output, '[]\n', 'utf8')
  await writeFile(options.versionOutput, `${JSON.stringify({
    version: '0.0.0',
    updatedAt: options.updatedAt,
    totalFoods: 0,
  }, null, 2)}\n`, 'utf8')
  console.warn(`CSV não encontrado. Criado catálogo vazio e seguro em ${options.output}.`)
}

async function convert(options) {
  if (extname(options.source).toLocaleLowerCase('pt-BR') === '.xlsx') {
    throw new Error('Use a versão CSV da base. A conversão de XLSX não é incluída para manter o bundle sem dependências extras.')
  }

  let text
  try {
    text = await readFile(options.source, 'utf8')
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      await writeStub(options)
      return
    }
    throw error
  }

  const rows = parseCsv(text.replace(/^\uFEFF/, ''), detectDelimiter(text))
  if (rows.length < 2) throw new Error('O CSV não possui cabeçalho e alimentos para importar.')

  const [headers, ...dataRows] = rows
  const columns = buildColumns(headers)
  if (columns.externalId < 0 || columns.name < 0) {
    throw new Error('Não foi possível localizar as colunas de código original e nome do alimento no CSV.')
  }

  const byExternalId = new Map()
  let skipped = 0
  for (const row of dataRows) {
    const food = makeFood(row, columns)
    if (!food) {
      skipped += 1
      continue
    }
    // `Map#set` intentionally replaces duplicate external IDs, making reruns idempotent.
    byExternalId.set(food.externalId, food)
  }

  const foods = [...byExternalId.values()]
  await mkdir(dirname(options.output), { recursive: true })
  await mkdir(dirname(options.versionOutput), { recursive: true })
  await writeFile(options.output, `${JSON.stringify(foods)}\n`, 'utf8')
  await writeFile(options.versionOutput, `${JSON.stringify({
    version: options.version,
    updatedAt: options.updatedAt,
    totalFoods: foods.length,
  }, null, 2)}\n`, 'utf8')

  console.log(`Catálogo criado: ${foods.length} alimentos em ${options.output}.`)
  if (skipped > 0) console.warn(`${skipped} linha(s) sem código ou nome foram ignoradas.`)
  if (foods.length !== dataRows.length - skipped) console.warn('Códigos externos duplicados foram mesclados pela última ocorrência.')
  console.log(`Fonte: ${basename(options.source)} | versão: ${options.version}`)
}

convert(parseArguments(process.argv.slice(2))).catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
