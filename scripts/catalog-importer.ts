import type { CatalogFood } from '../src/lib/food-catalog'

/** The public source contract is deliberately fixed to make data releases auditable. */
export const REQUIRED_CSV_HEADERS = [
  'codigo_usda',
  'nome_alimento_en',
  'categoria_en',
  'proteinas_g_100g',
  'carboidratos_g_100g',
  'fibras_g_100g',
  'gorduras_g_100g',
  'calorias_estimadas_kcal_100g',
  'quantidade_base',
  'unidade_base',
  'idioma_nome',
  'ativo',
  'fonte_url',
] as const

export const EXPECTED_CATALOG_TOTAL = 7083

export type CsvFoodRow = Record<(typeof REQUIRED_CSV_HEADERS)[number], string>

export type CatalogImportSummary = {
  importedFoods: number
  duplicateCodes: number
  ignoredRecords: number
  invalidRecords: number
}

export type CatalogImportResult = {
  foods: CatalogFood[]
  summary: CatalogImportSummary
}

const nutritionalColumns = [
  'proteinas_g_100g',
  'carboidratos_g_100g',
  'fibras_g_100g',
  'gorduras_g_100g',
  'calorias_estimadas_kcal_100g',
] as const

const normalizeText = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()
  .replace(/\s+/g, ' ')

const cleanText = (value: string) => value.trim().replace(/\s+/g, ' ')

const searchKeywords = (name: string, category: string | null) => {
  const phrases = [name, category ?? ''].map(normalizeText).filter(Boolean)
  return [...new Set([...phrases, ...phrases.flatMap((phrase) => phrase.split(' ').filter(Boolean))])]
}

const describeRow = (line: number, field: string, detail: string) => `Linha ${line}, campo "${field}": ${detail}`

/**
 * Parses semicolon, comma, or tab CSV without accepting malformed quoted fields.
 * It intentionally preserves empty rows so they cannot be silently skipped later.
 */
export function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  let line = 1

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
        if (character === '\n') line += 1
      }
      continue
    }

    if (character === '"') {
      if (field.length > 0) throw new Error(`CSV inválido: aspas inesperadas na linha ${line}.`)
      quoted = true
    } else if (character === delimiter) {
      row.push(field)
      field = ''
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && next === '\n') index += 1
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      line += 1
    } else {
      field += character
    }
  }

  if (quoted) throw new Error(`CSV inválido: aspas não fechadas na linha ${line}.`)
  if (row.length > 0 || field.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

export function detectCsvDelimiter(text: string): ',' | ';' | '\t' {
  const header = text.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] ?? ''
  const candidates = [',', ';', '\t'] as const
  return candidates.reduce((best, candidate) => {
    const candidateCount = header.split(candidate).length - 1
    const bestCount = header.split(best).length - 1
    return candidateCount > bestCount ? candidate : best
  }, ';' as ',' | ';' | '\t')
}

function assertExactHeaders(headers: readonly string[]): asserts headers is readonly (typeof REQUIRED_CSV_HEADERS)[number][] {
  const matches = headers.length === REQUIRED_CSV_HEADERS.length
    && headers.every((header, index) => header === REQUIRED_CSV_HEADERS[index])
  if (!matches) {
    throw new Error(`Cabeçalho CSV inválido. Esperado exatamente: ${REQUIRED_CSV_HEADERS.join(', ')}.`)
  }
}

function parseNonNegativeNumber(value: string, field: string, line: number): number {
  const normalized = value.trim()
  if (!normalized) throw new Error(describeRow(line, field, 'valor numérico obrigatório não informado.'))
  if (!/^[+-]?\d+(?:[,.]\d+)?$/.test(normalized)) {
    throw new Error(describeRow(line, field, `valor nutricional inválido "${value}".`))
  }

  const number = Number(normalized.replace(',', '.'))
  if (!Number.isFinite(number)) throw new Error(describeRow(line, field, `valor nutricional inválido "${value}".`))
  if (number < 0) throw new Error(describeRow(line, field, 'valores negativos não são permitidos.'))
  return number
}

function csvRow(values: readonly string[]): CsvFoodRow {
  return Object.fromEntries(REQUIRED_CSV_HEADERS.map((header, index) => [header, values[index]])) as CsvFoodRow
}

function toCatalogFood(row: CsvFoodRow, line: number): CatalogFood {
  const externalId = cleanText(row.codigo_usda)
  if (!externalId) throw new Error(describeRow(line, 'codigo_usda', 'código do alimento obrigatório não informado.'))

  const name = cleanText(row.nome_alimento_en)
  if (!name) throw new Error(describeRow(line, 'nome_alimento_en', 'nome do alimento obrigatório não informado.'))

  const baseQuantity = parseNonNegativeNumber(row.quantidade_base, 'quantidade_base', line)
  if (baseQuantity !== 100) throw new Error(describeRow(line, 'quantidade_base', 'deve ser igual a 100.'))

  const baseUnit = row.unidade_base.trim()
  if (baseUnit !== 'g') throw new Error(describeRow(line, 'unidade_base', 'deve ser igual a "g".'))

  const language = row.idioma_nome.trim()
  if (language !== 'en-US') throw new Error(describeRow(line, 'idioma_nome', 'deve ser igual a "en-US".'))

  const activeValue = row.ativo.trim()
  if (activeValue !== 'S' && activeValue !== 'N') {
    throw new Error(describeRow(line, 'ativo', 'deve ser "S" ou "N".'))
  }

  const nutrients = Object.fromEntries(nutritionalColumns.map((column) => [
    column,
    parseNonNegativeNumber(row[column], column, line),
  ])) as Record<(typeof nutritionalColumns)[number], number>
  const category = cleanText(row.categoria_en) || null
  const source = cleanText(row.fonte_url) || null

  return {
    externalId,
    name,
    nameNormalized: normalizeText(name),
    searchKeywords: searchKeywords(name, category),
    category,
    brand: null,
    calories: nutrients.calorias_estimadas_kcal_100g,
    protein: nutrients.proteinas_g_100g,
    carbs: nutrients.carboidratos_g_100g,
    fat: nutrients.gorduras_g_100g,
    fiber: nutrients.fibras_g_100g,
    baseQuantity,
    baseUnit,
    unitWeightG: null,
    portionWeightG: null,
    source,
    language,
    isActive: activeValue === 'S',
  }
}

/** Revalidates the generated runtime schema before files are written. */
export function validateCatalogFoods(foods: readonly CatalogFood[]): void {
  if (foods.length !== EXPECTED_CATALOG_TOTAL) {
    throw new Error(`Total final inválido: esperado ${EXPECTED_CATALOG_TOTAL} alimentos, recebido ${foods.length}.`)
  }

  const ids = new Set<string>()
  foods.forEach((food, index) => {
    const record = index + 1
    if (!food.externalId) throw new Error(`Catálogo inválido: externalId ausente no registro ${record}.`)
    if (ids.has(food.externalId)) throw new Error(`Catálogo inválido: externalId duplicado "${food.externalId}".`)
    ids.add(food.externalId)
    if (!food.name.trim()) throw new Error(`Catálogo inválido: nome ausente para "${food.externalId}".`)

    const nutrients = [food.calories, food.protein, food.carbs, food.fat, food.fiber]
    if (nutrients.some((value) => !Number.isFinite(value) || value < 0)) {
      throw new Error(`Catálogo inválido: valor nutricional inválido para "${food.externalId}".`)
    }
    if (food.baseQuantity !== 100) throw new Error(`Catálogo inválido: baseQuantity deve ser 100 para "${food.externalId}".`)
    if (food.baseUnit !== 'g') throw new Error(`Catálogo inválido: baseUnit deve ser g para "${food.externalId}".`)
    if (food.language !== 'en-US') throw new Error(`Catálogo inválido: language deve ser en-US para "${food.externalId}".`)
    if (typeof food.isActive !== 'boolean') throw new Error(`Catálogo inválido: isActive inválido para "${food.externalId}".`)
  })
}

/**
 * Validates every record before returning it. Callers must only persist the
 * result after this function resolves, preserving the last known-good output
 * when a source is missing or malformed.
 */
export function importCatalogCsv(text: string): CatalogImportResult {
  const rows = parseCsv(text.replace(/^\uFEFF/, ''), detectCsvDelimiter(text))
  if (rows.length === 0) throw new Error('CSV inválido: o arquivo está vazio.')

  const [headers, ...records] = rows
  assertExactHeaders(headers)
  if (records.length === 0) throw new Error('CSV inválido: não há registros de alimentos.')

  const foods: CatalogFood[] = []
  const externalIds = new Set<string>()
  records.forEach((values, index) => {
    const line = index + 2
    if (values.length !== REQUIRED_CSV_HEADERS.length) {
      throw new Error(`Linha ${line}: esperado ${REQUIRED_CSV_HEADERS.length} colunas, recebido ${values.length}.`)
    }

    const food = toCatalogFood(csvRow(values), line)
    if (externalIds.has(food.externalId)) {
      throw new Error(describeRow(line, 'codigo_usda', `código duplicado "${food.externalId}".`))
    }
    externalIds.add(food.externalId)
    foods.push(food)
  })

  validateCatalogFoods(foods)
  return {
    foods,
    summary: {
      importedFoods: foods.length,
      duplicateCodes: 0,
      ignoredRecords: 0,
      invalidRecords: 0,
    },
  }
}
