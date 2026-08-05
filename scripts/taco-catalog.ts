import type { CatalogFood } from '../src/lib/food-catalog'
import { buildSearchKeywords, normalizeFoodName } from '../src/lib/food-catalog'
import { detectCsvDelimiter, parseCsv, validateCatalogFoods } from './catalog-importer'

export const TACO_SOURCE_LABEL = 'TACO 4ª ed. NEPA/UNICAMP'

export type TacoRecord = {
  sourceFoodNumber: number
  group: string
  description: string
  calories: number
  protein: number
  fat: number
  carbs: number
  fiber: number
  sodium?: number
  line: number
}

export type TacoSkip = {
  line: number
  sourceFoodNumber: string
  description: string
  reason: string
}

export type TacoCatalogSummary = {
  sourceRows: number
  validRows: number
  usableRows: number
  selectedFoods: number
  duplicateWithCurated: number
  duplicateWithinTaco: number
  priorityOmissions: number
  skipped: TacoSkip[]
  categoryDistribution: Record<string, number>
}

export type TacoCatalogBuild = {
  foods: CatalogFood[]
  tacoFoods: CatalogFood[]
  summary: TacoCatalogSummary
}

const normalizeHeader = (value: string) => normalizeFoodName(value).replace(/[^a-z0-9]/g, '')

const MISSING_NUMBERS = new Set(['', 'na', 'n a', '*', '-', '--', 'nd', 'n d'])

/**
 * Qualifiers removed only for identity comparison. Preparation words are never
 * removed, so raw, cooked, fried and grilled records remain distinct.
 */
const IDENTITY_FILLER = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para',
])

const SYNONYMS: Record<string, string> = {
  'açucar': 'acucar',
  'mandioca': 'aipim',
  'macaxeira': 'aipim',
  'aipim': 'aipim',
}

/**
 * Reviewed against the preserved 126 records. These numbers include close
 * aliases that purely lexical matching cannot safely infer (for example,
 * word-order and "tipo 1" labels). The list is part of the release contract:
 * it prevents reintroducing an already-curated food on later regenerations.
 */
export const CURATED_DUPLICATE_SOURCE_NUMBERS = new Set([
  1, 3, 7, 8, 13, 16, 52, 53, 64, 70, 79, 82, 88, 91, 95, 97, 98, 100,
  107, 109, 110, 112, 115, 118, 129, 140, 142, 144, 145, 149, 163, 164,
  168, 169, 179, 182, 200, 214, 225, 229, 235, 236, 239, 243, 256, 261,
  319, 328, 351, 356, 377, 401, 403, 408, 410, 413, 429, 432, 461, 463,
  467, 468, 469, 478, 480, 481, 484, 486, 488, 490, 494, 495, 507, 524,
  560, 561, 563, 567, 577, 590,
])

/** Alcohol is intentionally not offered as a common diary-food suggestion. */
export const PRIORITY_OMISSION_SOURCE_NUMBERS = new Set([474])

const fieldAliases = {
  sourceFoodNumber: ['numero do alimento', 'número do alimento', 'numero', 'número'],
  group: ['grupo'],
  description: ['descrição dos alimentos', 'descricao dos alimentos', 'descricao'],
  calories: ['energia kcal', 'energia'],
  protein: ['proteína g', 'proteina g'],
  fat: ['lipídeos g', 'lipideos g'],
  carbs: ['carboidrato g', 'carboidratos g'],
  fiber: ['fibra alimentar g', 'fibra g'],
  sodium: ['sódio mg', 'sodio mg'],
} as const

function valueAt(row: Record<string, string>, aliases: readonly string[]) {
  for (const alias of aliases) {
    const found = row[normalizeHeader(alias)]
    if (found !== undefined) return found
  }
  return ''
}

/** TACO uses comma decimals and `Tr`; a trace is represented explicitly. */
export function parseTacoNumber(value: string): number | null {
  const clean = value.trim().replace(/\u00a0/g, ' ')
  const normalized = normalizeFoodName(clean)
  if (normalized === 'tr') return 0.00001
  if (MISSING_NUMBERS.has(normalized)) return null
  if (!/^[+-]?\d+(?:[.,]\d+)?$/.test(clean)) return null
  const number = Number(clean.replace(',', '.'))
  return Number.isFinite(number) && number >= 0 ? number : null
}

function cleanText(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

/**
 * Normalizes only food identity, not the display name. It is deliberately
 * conservative: meaningful preparation terms stay in the identity.
 */
export function normalizeFoodIdentity(name: string): string {
  const tokens = normalizeFoodName(name)
    .split(' ')
    .filter(Boolean)
    .map((token) => SYNONYMS[token] ?? token)
    .filter((token) => !IDENTITY_FILLER.has(token))
  // Sorting makes "peito de frango grelhado" and "frango, peito, grelhado"
  // comparable while retaining all meaningful preparation and variant tokens.
  return [...tokens].sort((left, right) => left.localeCompare(right, 'pt-BR')).join(' ')
}

/** Catches only a stable normalized identity; material variants stay distinct. */
export function isObviousFoodDuplicate(left: string, right: string): boolean {
  const leftIdentity = normalizeFoodIdentity(left)
  const rightIdentity = normalizeFoodIdentity(right)
  return Boolean(leftIdentity) && leftIdentity === rightIdentity
}

export function parseTacoCsv(text: string): { records: TacoRecord[]; skipped: TacoSkip[]; sourceRows: number } {
  const rows = parseCsv(text.replace(/^\uFEFF/, ''), detectCsvDelimiter(text))
  if (rows.length < 2) throw new Error('Fonte TACO vazia ou sem registros.')
  const [rawHeaders, ...rawRecords] = rows
  const headers = rawHeaders.map(normalizeHeader)
  const requiredKeys = [
    fieldAliases.sourceFoodNumber, fieldAliases.group, fieldAliases.description, fieldAliases.calories,
    fieldAliases.protein, fieldAliases.fat, fieldAliases.carbs, fieldAliases.fiber,
  ]
  for (const aliases of requiredKeys) {
    if (!aliases.some((alias) => headers.includes(normalizeHeader(alias)))) {
      throw new Error(`Fonte TACO sem coluna obrigatória: ${aliases[0]}.`)
    }
  }

  const records: TacoRecord[] = []
  const skipped: TacoSkip[] = []
  const codes = new Set<number>()
  rawRecords.forEach((cells, index) => {
    const line = index + 2
    const row = Object.fromEntries(headers.map((header, cellIndex) => [header, cells[cellIndex] ?? '']))
    const rawCode = cleanText(valueAt(row, fieldAliases.sourceFoodNumber))
    const code = parseTacoNumber(rawCode)
    const description = cleanText(valueAt(row, fieldAliases.description))
    const group = cleanText(valueAt(row, fieldAliases.group))
    const values = {
      calories: parseTacoNumber(valueAt(row, fieldAliases.calories)),
      protein: parseTacoNumber(valueAt(row, fieldAliases.protein)),
      fat: parseTacoNumber(valueAt(row, fieldAliases.fat)),
      carbs: parseTacoNumber(valueAt(row, fieldAliases.carbs)),
      fiber: parseTacoNumber(valueAt(row, fieldAliases.fiber)),
      sodium: parseTacoNumber(valueAt(row, fieldAliases.sodium)),
    }
    const requiredMissing = [
      !Number.isInteger(code) || (code ?? 0) <= 0 ? 'código' : '',
      !group ? 'categoria' : '',
      !description || description.length < 2 ? 'nome' : '',
      values.calories == null ? 'calorias' : '',
      values.protein == null ? 'proteínas' : '',
      values.fat == null ? 'gorduras' : '',
      values.carbs == null ? 'carboidratos' : '',
    ].filter(Boolean)
    if (requiredMissing.length) {
      skipped.push({ line, sourceFoodNumber: rawCode, description, reason: `campo obrigatório ausente/inválido: ${requiredMissing.join(', ')}` })
      return
    }
    if (codes.has(code!)) {
      skipped.push({ line, sourceFoodNumber: rawCode, description, reason: 'código TACO duplicado na fonte' })
      return
    }
    codes.add(code!)
    records.push({
      sourceFoodNumber: code!,
      group,
      description,
      calories: values.calories!,
      protein: values.protein!,
      fat: values.fat!,
      carbs: values.carbs!,
      // Some TACO rows legitimately do not publish fiber (meat, eggs, oils).
      fiber: values.fiber ?? 0,
      ...(values.sodium == null ? {} : { sodium: values.sodium }),
      line,
    })
  })
  return { records, skipped, sourceRows: rawRecords.length }
}

function tacoFood(record: TacoRecord): CatalogFood {
  const name = record.description
  return {
    externalId: `TACO${String(record.sourceFoodNumber).padStart(4, '0')}`,
    name,
    nameNormalized: normalizeFoodName(name),
    searchKeywords: buildSearchKeywords(name, record.group),
    category: record.group,
    brand: null,
    calories: record.calories,
    protein: record.protein,
    carbs: record.carbs,
    fat: record.fat,
    fiber: record.fiber,
    ...(record.sodium == null ? {} : { sodium: record.sodium }),
    baseQuantity: 100,
    baseUnit: 'g',
    unitWeightG: null,
    portionWeightG: null,
    source: TACO_SOURCE_LABEL,
    language: 'pt-BR',
    isActive: true,
    catalogOrigin: 'taco',
    sourceFoodNumber: record.sourceFoodNumber,
    measurementPolicy: 'mass-source',
  }
}

function selectTacoFoods(candidates: readonly TacoRecord[], total: number): TacoRecord[] {
  if (candidates.length < total) {
    throw new Error(`A fonte TACO possui apenas ${candidates.length} registros novos aproveitáveis; são necessários ${total}.`)
  }
  if (candidates.length !== total) {
    throw new Error(`A política de seleção TACO deixou ${candidates.length} candidatos; o contrato exige exatamente ${total}. Revise as exclusões auditadas.`)
  }
  return [...candidates].sort((left, right) => left.sourceFoodNumber - right.sourceFoodNumber)
}

export function buildTacoCatalog(curatedFoods: readonly CatalogFood[], tacoText: string, additionalTotal: number, expectedTotal: number): TacoCatalogBuild {
  if (!Number.isInteger(additionalTotal) || additionalTotal <= 0) throw new Error('additionalTotal deve ser um inteiro positivo.')
  if (curatedFoods.length + additionalTotal !== expectedTotal) {
    throw new Error(`Contrato de total inválido: ${curatedFoods.length} atuais + ${additionalTotal} TACO não resulta em ${expectedTotal}.`)
  }
  const parsed = parseTacoCsv(tacoText)
  const skipped = [...parsed.skipped]
  const curated = curatedFoods.map((food) => ({ ...food, catalogOrigin: 'curated-br' as const, sourceFoodNumber: null }))
  const accepted: TacoRecord[] = []
  const existingNames = curated.map((food) => food.name)
  const acceptedNames: string[] = []
  let duplicateWithCurated = 0
  let duplicateWithinTaco = 0
  let priorityOmissions = 0

  for (const record of parsed.records) {
    if (CURATED_DUPLICATE_SOURCE_NUMBERS.has(record.sourceFoodNumber)) {
      duplicateWithCurated += 1
      skipped.push({ line: record.line, sourceFoodNumber: String(record.sourceFoodNumber), description: record.description, reason: 'duplicidade revisada com alimento curado existente' })
      continue
    }
    if (PRIORITY_OMISSION_SOURCE_NUMBERS.has(record.sourceFoodNumber)) {
      priorityOmissions += 1
      skipped.push({ line: record.line, sourceFoodNumber: String(record.sourceFoodNumber), description: record.description, reason: 'omissão de prioridade: bebida alcoólica fora do catálogo sugerido' })
      continue
    }
    if (existingNames.some((name) => isObviousFoodDuplicate(name, record.description))) {
      throw new Error(`Duplicidade não mapeada com o catálogo curado: TACO${String(record.sourceFoodNumber).padStart(4, '0')} (${record.description}).`)
    }
    if (acceptedNames.some((name) => isObviousFoodDuplicate(name, record.description))) {
      duplicateWithinTaco += 1
      throw new Error(`Duplicidade não mapeada dentro da fonte TACO: TACO${String(record.sourceFoodNumber).padStart(4, '0')} (${record.description}).`)
    }
    accepted.push(record)
    acceptedNames.push(record.description)
  }

  const selectedRecords = selectTacoFoods(accepted, additionalTotal)
  const tacoFoods = selectedRecords.map(tacoFood)
  const foods = [...curated, ...tacoFoods]
  validateCatalogFoods(foods, expectedTotal)
  const categoryDistribution = tacoFoods.reduce<Record<string, number>>((distribution, food) => {
    const category = food.category ?? 'Sem categoria'
    distribution[category] = (distribution[category] ?? 0) + 1
    return distribution
  }, {})
  return {
    foods,
    tacoFoods,
    summary: {
      sourceRows: parsed.sourceRows,
      validRows: parsed.records.length,
      usableRows: accepted.length,
      selectedFoods: tacoFoods.length,
      duplicateWithCurated,
      duplicateWithinTaco,
      priorityOmissions,
      skipped,
      categoryDistribution,
    },
  }
}

export const csvEscape = (value: string | number | null | undefined) => {
  const text = value == null ? '' : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function foodsToCsv(foods: readonly CatalogFood[]): string {
  const headers = [
    'externalId', 'name', 'category', 'brand', 'calories', 'protein', 'carbs', 'fat', 'fiber', 'sodium',
    'baseQuantity', 'baseUnit', 'unitWeightG', 'portionWeightG', 'source', 'language', 'isActive',
    'catalogOrigin', 'sourceFoodNumber',
  ] as const
  const rows = foods.map((food) => [
    food.externalId, food.name, food.category, food.brand, food.calories, food.protein, food.carbs, food.fat, food.fiber, food.sodium,
    food.baseQuantity, food.baseUnit, food.unitWeightG, food.portionWeightG, food.source, food.language, food.isActive ? 'true' : 'false',
    food.catalogOrigin, food.sourceFoodNumber,
  ].map(csvEscape).join(','))
  return `${headers.join(',')}\n${rows.join('\n')}\n`
}

export function importReportMarkdown(summary: TacoCatalogSummary, sourceHash?: string, selectionHash?: string, idsHash?: string): string {
  const distribution = Object.entries(summary.categoryDistribution)
    .sort(([left], [right]) => left.localeCompare(right, 'pt-BR'))
    .map(([category, total]) => `| ${category} | ${total} |`)
    .join('\n')
  const skippedSample = summary.skipped.slice(0, 30)
    .map((item) => `| ${item.line} | ${item.sourceFoodNumber || '—'} | ${item.description || '—'} | ${item.reason} |`)
    .join('\n') || '| — | — | — | Nenhum |'
  return `# Relatório de importação de alimentos — NutriPro\n\n`
    + `Data: 2026-08-01  \nFonte: ${TACO_SOURCE_LABEL}  \n`
    + (sourceHash ? `SHA-256 da fonte baixada: \`${sourceHash}\`\n` : '')
    + `\n## Resultado\n\n`
    + `- Catálogo curado preservado: 126 alimentos (IDs \`BR0001\` a \`BR0126\`).\n`
    + `- Registros TACO de origem: ${summary.sourceRows}.\n`
    + `- Registros com campos obrigatórios completos: ${summary.validRows}.\n`
    + `- Registros TACO elegíveis após duplicidades e prioridade: ${summary.usableRows}.\n`
    + `- Novos registros TACO selecionados: ${summary.selectedFoods}.\n`
    + `- Total final validado: ${126 + summary.selectedFoods}.\n`
    + `- Duplicidades revisadas contra os 126 curados: ${summary.duplicateWithCurated}.\n`
    + `- Duplicidades óbvias internas TACO: ${summary.duplicateWithinTaco}.\n`
    + `- Omissões por prioridade de catálogo: ${summary.priorityOmissions}.\n`
    + `- Registros ignorados/inválidos: ${summary.skipped.length}.\n\n`
    + `## Política de seleção\n\n`
    + `A lista final usa somente a fonte primária TACO preservada em \`data/sources/taco-4a-edicao-cleaned.csv\`. O espelho de contingência foi consultado apenas para auditoria: o código 540 aparece como \`L\` na fonte primária e como “Feijoada” no espelho; ele foi ignorado porque já existe no catálogo curado.\n\n`
    + `A identidade de alimentos remove acentos, pontuação, conectores e diferenças de ordem, mas mantém termos materiais — inclusive preparo (cru/cozido/frito/assado/grelhado), sabor, corte, sal, pele e conservação. Uma lista revisada de 80 códigos TACO impede colisões com os 126 alimentos curados; o código 474 (cerveja) foi omitido da seleção sugerida. Não houve duplicidades internas após essa verificação.\n\n`
    + (selectionHash ? `Checksum SHA-256 dos códigos TACO selecionados (ordem crescente): \`${selectionHash}\`.  \n` : '')
    + (idsHash ? `Checksum SHA-256 dos IDs TACO selecionados: \`${idsHash}\`.\n\n` : '')
    + `## Distribuição dos 500 novos alimentos\n\n| Categoria TACO | Total |\n| --- | ---: |\n${distribution}\n\n`
    + `## Amostra de registros ignorados\n\n| Linha | Código | Descrição | Motivo |\n| ---: | --- | --- | --- |\n${skippedSample}\n\n`
    + `A importação converteu \`Tr\` em \`0,00001\`; \`NA\`, \`*\` e campos vazios foram tratados como ausentes. Registros sem calorias, proteínas, gorduras, carboidratos, nome, categoria ou código foram recusados. A fibra não é campo eliminatório da TACO e é representada como \`0\` quando a fonte não a publica; nenhum valor ausente de calorias, proteínas, gorduras ou carboidratos foi inventado.\n`
}
