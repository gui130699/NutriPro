import type { CatalogFood } from '../src/lib/food-catalog'

/** Contracts are explicit so every imported catalogue remains auditable. */
export const INTERNATIONAL_CSV_HEADERS = [
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

export const BRAZILIAN_CSV_HEADERS = [
  'codigo_alimento',
  'nome_alimento_pt_br',
  'categoria_pt_br',
  'marca',
  'calorias_kcal_100',
  'proteinas_g_100',
  'carboidratos_g_100',
  'gorduras_g_100',
  'fibras_g_100',
  'quantidade_base',
  'unidade_base',
  'peso_medio_unidade_g',
  'peso_porcao_g',
  'idioma_nome',
  'ativo',
  'fonte',
] as const

export type CatalogImportOptions = {
  expectedTotal: number
}

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

type CsvRow = Record<string, string>
type CsvSchema = {
  id: 'international' | 'brazilian'
  headers: readonly string[]
  externalId: string
  name: string
  category: string
  brand?: string
  calories: string
  protein: string
  carbs: string
  fat: string
  fiber: string
  baseQuantity: string
  baseUnit: string
  unitWeightG?: string
  portionWeightG?: string
  language: string
  active: string
  source: string
  expectedLanguage: 'pt-BR' | 'en-US'
}

const schemas: readonly CsvSchema[] = [
  {
    id: 'international',
    headers: INTERNATIONAL_CSV_HEADERS,
    externalId: 'codigo_usda',
    name: 'nome_alimento_en',
    category: 'categoria_en',
    calories: 'calorias_estimadas_kcal_100g',
    protein: 'proteinas_g_100g',
    carbs: 'carboidratos_g_100g',
    fat: 'gorduras_g_100g',
    fiber: 'fibras_g_100g',
    baseQuantity: 'quantidade_base',
    baseUnit: 'unidade_base',
    language: 'idioma_nome',
    active: 'ativo',
    source: 'fonte_url',
    expectedLanguage: 'en-US',
  },
  {
    id: 'brazilian',
    headers: BRAZILIAN_CSV_HEADERS,
    externalId: 'codigo_alimento',
    name: 'nome_alimento_pt_br',
    category: 'categoria_pt_br',
    brand: 'marca',
    calories: 'calorias_kcal_100',
    protein: 'proteinas_g_100',
    carbs: 'carboidratos_g_100',
    fat: 'gorduras_g_100',
    fiber: 'fibras_g_100',
    baseQuantity: 'quantidade_base',
    baseUnit: 'unidade_base',
    unitWeightG: 'peso_medio_unidade_g',
    portionWeightG: 'peso_porcao_g',
    language: 'idioma_nome',
    active: 'ativo',
    source: 'fonte',
    expectedLanguage: 'pt-BR',
  },
]

const normalizeText = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()
  .replace(/\s+/g, ' ')

const cleanText = (value: string) => value.trim().replace(/\s+/g, ' ')

const searchKeywords = (name: string, category: string | null, brand: string | null) => {
  const phrases = [name, category ?? '', brand ?? ''].map(normalizeText).filter(Boolean)
  return [...new Set([...phrases, ...phrases.flatMap((phrase) => phrase.split(' ').filter(Boolean))])]
}

const describeRow = (line: number, field: string, detail: string) => `Linha ${line}, campo "${field}": ${detail}`

export function assertExpectedTotal(expectedTotal: number): void {
  if (!Number.isInteger(expectedTotal) || expectedTotal <= 0) {
    throw new Error('O total esperado deve ser um número inteiro maior que zero.')
  }
}

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

function resolveSchema(headers: readonly string[]): CsvSchema {
  const schema = schemas.find((candidate) => candidate.headers.length === headers.length
    && candidate.headers.every((header, index) => header === headers[index]))
  if (!schema) {
    const expected = schemas.map((candidate) => candidate.headers.join(', ')).join(' | ')
    throw new Error(`Cabeçalho CSV inválido. Esperado exatamente um dos contratos: ${expected}.`)
  }
  return schema
}

function normalizeRowWidth(values: readonly string[], schema: CsvSchema, line: number): string[] {
  if (values.length !== schema.headers.length) {
    throw new Error(`Linha ${line}: esperado ${schema.headers.length} colunas, recebido ${values.length}.`)
  }
  return [...values]
}

function csvRow(values: readonly string[], schema: CsvSchema): CsvRow {
  return Object.fromEntries(schema.headers.map((header, index) => [header, values[index] ?? '']))
}

function parseNonNegativeNumber(value: string, field: string, line: number): number {
  const normalized = value.trim()
  if (!normalized) throw new Error(describeRow(line, field, 'valor numérico obrigatório não informado.'))
  if (!/^[+-]?\d+(?:[,.]\d+)?$/.test(normalized)) {
    throw new Error(describeRow(line, field, `valor numérico inválido "${value}".`))
  }

  const number = Number(normalized.replace(',', '.'))
  if (!Number.isFinite(number)) throw new Error(describeRow(line, field, `valor numérico inválido "${value}".`))
  if (number < 0) throw new Error(describeRow(line, field, 'valores negativos não são permitidos.'))
  return number
}

function parseOptionalWeight(value: string, field: string, line: number): number | null {
  if (!value.trim()) return null
  const weight = parseNonNegativeNumber(value, field, line)
  return weight > 0 ? weight : null
}

function toCatalogFood(row: CsvRow, schema: CsvSchema, line: number): CatalogFood {
  const externalId = cleanText(row[schema.externalId] ?? '')
  if (!externalId) throw new Error(describeRow(line, schema.externalId, 'código do alimento obrigatório não informado.'))

  const name = cleanText(row[schema.name] ?? '')
  if (!name) throw new Error(describeRow(line, schema.name, 'nome do alimento obrigatório não informado.'))

  const baseQuantity = parseNonNegativeNumber(row[schema.baseQuantity] ?? '', schema.baseQuantity, line)
  if (baseQuantity !== 100) throw new Error(describeRow(line, schema.baseQuantity, 'deve ser igual a 100.'))

  const baseUnit = cleanText(row[schema.baseUnit] ?? '')
  if (baseUnit !== 'g' && baseUnit !== 'ml') {
    throw new Error(describeRow(line, schema.baseUnit, 'deve ser igual a "g" ou "ml".'))
  }

  const language = cleanText(row[schema.language] ?? '')
  if (language !== 'pt-BR' && language !== 'en-US') {
    throw new Error(describeRow(line, schema.language, 'deve ser igual a "pt-BR" ou "en-US".'))
  }
  if (language !== schema.expectedLanguage) {
    throw new Error(describeRow(line, schema.language, `deve ser igual a "${schema.expectedLanguage}" para este contrato.`))
  }

  const activeValue = cleanText(row[schema.active] ?? '').toUpperCase()
  if (activeValue !== 'S' && activeValue !== 'N') {
    throw new Error(describeRow(line, schema.active, 'deve ser "S" ou "N".'))
  }

  const category = cleanText(row[schema.category] ?? '') || null
  const brand = schema.brand ? cleanText(row[schema.brand] ?? '') || null : null
  const source = cleanText(row[schema.source] ?? '') || null

  return {
    externalId,
    name,
    nameNormalized: normalizeText(name),
    searchKeywords: searchKeywords(name, category, brand),
    category,
    brand,
    calories: parseNonNegativeNumber(row[schema.calories] ?? '', schema.calories, line),
    protein: parseNonNegativeNumber(row[schema.protein] ?? '', schema.protein, line),
    carbs: parseNonNegativeNumber(row[schema.carbs] ?? '', schema.carbs, line),
    fat: parseNonNegativeNumber(row[schema.fat] ?? '', schema.fat, line),
    fiber: parseNonNegativeNumber(row[schema.fiber] ?? '', schema.fiber, line),
    baseQuantity,
    baseUnit,
    unitWeightG: schema.unitWeightG ? parseOptionalWeight(row[schema.unitWeightG] ?? '', schema.unitWeightG, line) : null,
    portionWeightG: schema.portionWeightG ? parseOptionalWeight(row[schema.portionWeightG] ?? '', schema.portionWeightG, line) : null,
    source,
    language,
    isActive: activeValue === 'S',
  }
}

/** Revalidates the generated runtime schema before files are written. */
export function validateCatalogFoods(foods: readonly CatalogFood[], expectedTotal: number): void {
  assertExpectedTotal(expectedTotal)
  if (foods.length !== expectedTotal) {
    throw new Error(`Total final inválido: esperado ${expectedTotal} alimentos, recebido ${foods.length}.`)
  }

  const ids = new Set<string>()
  foods.forEach((food, index) => {
    const record = index + 1
    if (!food.externalId) throw new Error(`Catálogo inválido: externalId ausente no registro ${record}.`)
    if (ids.has(food.externalId)) throw new Error(`Catálogo inválido: externalId duplicado "${food.externalId}".`)
    ids.add(food.externalId)
    if (!food.name.trim()) throw new Error(`Catálogo inválido: nome ausente para "${food.externalId}".`)
    if (!food.nameNormalized) throw new Error(`Catálogo inválido: nameNormalized ausente para "${food.externalId}".`)
    if (!food.searchKeywords.length) throw new Error(`Catálogo inválido: searchKeywords ausente para "${food.externalId}".`)

    const nutrients = [food.calories, food.protein, food.carbs, food.fat, food.fiber]
    if (nutrients.some((value) => !Number.isFinite(value) || value < 0)) {
      throw new Error(`Catálogo inválido: valor nutricional inválido para "${food.externalId}".`)
    }
    if (food.baseQuantity !== 100) throw new Error(`Catálogo inválido: baseQuantity deve ser 100 para "${food.externalId}".`)
    if (food.baseUnit !== 'g' && food.baseUnit !== 'ml') throw new Error(`Catálogo inválido: baseUnit deve ser g ou ml para "${food.externalId}".`)
    if (food.language !== 'pt-BR' && food.language !== 'en-US') throw new Error(`Catálogo inválido: language inválido para "${food.externalId}".`)
    if (food.unitWeightG != null && (!(food.unitWeightG > 0) || !Number.isFinite(food.unitWeightG))) throw new Error(`Catálogo inválido: unitWeightG inválido para "${food.externalId}".`)
    if (food.portionWeightG != null && (!(food.portionWeightG > 0) || !Number.isFinite(food.portionWeightG))) throw new Error(`Catálogo inválido: portionWeightG inválido para "${food.externalId}".`)
    if (typeof food.isActive !== 'boolean') throw new Error(`Catálogo inválido: isActive inválido para "${food.externalId}".`)
    if (food.catalogOrigin != null && food.catalogOrigin !== 'curated-br' && food.catalogOrigin !== 'taco') {
      throw new Error(`Catálogo inválido: catalogOrigin inválido para "${food.externalId}".`)
    }
    if (food.sourceFoodNumber != null && (!Number.isInteger(food.sourceFoodNumber) || food.sourceFoodNumber <= 0)) {
      throw new Error(`Catálogo inválido: sourceFoodNumber inválido para "${food.externalId}".`)
    }
  })
}

/**
 * Validates every record before returning it. Callers must only persist the
 * result after this function resolves, preserving the last known-good output
 * when a source is missing or malformed.
 */
export function importCatalogCsv(text: string, options: CatalogImportOptions): CatalogImportResult {
  assertExpectedTotal(options.expectedTotal)
  const rows = parseCsv(text.replace(/^\uFEFF/, ''), detectCsvDelimiter(text))
  if (rows.length === 0) throw new Error('CSV inválido: o arquivo está vazio.')

  const [headers, ...records] = rows
  const schema = resolveSchema(headers)
  if (records.length === 0) throw new Error('CSV inválido: não há registros de alimentos.')

  const foods: CatalogFood[] = []
  const externalIds = new Set<string>()
  records.forEach((rawValues, index) => {
    const line = index + 2
    const values = normalizeRowWidth(rawValues, schema, line)
    const food = toCatalogFood(csvRow(values, schema), schema, line)
    if (externalIds.has(food.externalId)) {
      throw new Error(describeRow(line, schema.externalId, `código duplicado "${food.externalId}".`))
    }
    externalIds.add(food.externalId)
    foods.push(food)
  })

  validateCatalogFoods(foods, options.expectedTotal)
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
